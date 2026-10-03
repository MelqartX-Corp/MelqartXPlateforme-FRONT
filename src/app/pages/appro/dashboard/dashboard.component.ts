import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ComponentService } from '../../../modules/stock/services/component.service';
import { SupplierService } from '../../../modules/stock/services/supplier.service';
import { ReelService } from '../../../modules/stock/services/reel.service';
import { LotService } from '../../../modules/stock/services/lot.service';
import { ComponentStockSummary, Lot, Supplier } from '../../../modules/stock/models/stock.models';

/**
 * Tableau de bord de l'approvisionnement.
 *
 * L'appro ne pilote pas des quantités, il pilote des manques : ce qui va
 * tomber sous le seuil, ce qui est commandé et n'arrive pas, ce qui est
 * promis à un projet et ne doit donc plus être compté comme disponible.
 *
 * D'où le parti pris : aucune carte ne dit « voilà combien vous avez ». Elles
 * disent toutes « voilà ce sur quoi il faut agir », et chacune mène à l'écran
 * où l'on agit.
 */
@Component({
  selector: 'app-appro-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class ApproDashboardComponent implements OnInit {
  private componentSvc = inject(ComponentService);
  private supplierSvc = inject(SupplierService);
  private reelSvc = inject(ReelService);
  private lotSvc = inject(LotService);

  chargement = signal(true);
  erreur = signal<string | null>(null);

  totalComposants = signal(0);
  totalFournisseurs = signal(0);
  totalBobines = signal(0);

  resume = signal<ComponentStockSummary[]>([]);
  lots = signal<Lot[]>([]);
  fournisseurs = signal<Supplier[]>([]);

  // ── Ce qu'il faut réapprovisionner ──

  /** Références sous leur seuil de bobines — la file de commandes à passer. */
  readonly sousSeuil = computed(() =>
    this.resume().filter(s => s.belowThreshold));

  /**
   * Références dont tout le disponible est déjà promis.
   *
   * Elles ne sont pas « en rupture » au sens du stock physique — les pièces
   * sont là — mais elles le sont pour le prochain projet, et c'est ce qui
   * compte pour décider d'une commande.
   */
  readonly entierementReservees = computed(() =>
    this.resume().filter(s =>
      this.reserve(s) > 0 && this.disponible(s) === 0));

  /** Pièces mises de côté pour des projets payés, toutes références confondues. */
  readonly totalReserve = computed(() =>
    this.resume().reduce((total, s) => total + (s.totalQuantityReserved ?? 0), 0));

  /** Pièces réellement à prendre : le physique moins ce qui est promis. */
  readonly totalDisponible = computed(() =>
    this.resume().reduce((total, s) => total + this.disponible(s), 0));

  readonly totalPhysique = computed(() =>
    this.resume().reduce((total, s) => total + s.totalQuantityRemaining, 0));

  /** Part du stock déjà engagée — au-delà de 50 %, la marge de manœuvre est mince. */
  readonly tauxEngagement = computed(() => {
    const physique = this.totalPhysique();
    return physique > 0 ? Math.round((this.totalReserve() / physique) * 100) : 0;
  });

  // ── Ce qui est commandé et n'est pas là ──

  readonly lotsEnAttente = computed(() =>
    this.lots().filter(l => l.status === 'COMMANDE' || l.status === 'PARTIELLEMENT_RECU'));

  /**
   * Livraisons dont la date estimée est passée.
   *
   * Un retard fournisseur ne se signale pas tout seul : sans cette ligne il
   * se découvre le jour où l'atelier vient chercher les pièces.
   */
  readonly lotsEnRetard = computed(() =>
    this.lotsEnAttente().filter(l => {
      if (!l.estimatedDeliveryDate) return false;
      return new Date(l.estimatedDeliveryDate).getTime() < Date.now();
    }));

  readonly piecesAttendues = computed(() =>
    this.lotsEnAttente().reduce(
      (total, l) => total + Math.max(0, (l.totalExpected ?? 0) - (l.totalReceived ?? 0)), 0));

  /** Les dernières livraisons, reçues ou non — le fil de ce qui arrive. */
  readonly lotsRecents = computed(() => this.lots().slice(0, 6));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);

    forkJoin({
      composants: this.componentSvc.getComponents(0, 1),
      fournisseurs: this.supplierSvc.getSuppliers(),
      bobines: this.reelSvc.getReels(0, 1),
      lots: this.lotSvc.getLots(0, 50),
      resume: this.reelSvc.getStockSummary()
    }).subscribe({
      next: data => {
        this.totalComposants.set(data.composants.totalElements);
        this.totalFournisseurs.set(data.fournisseurs.length);
        this.totalBobines.set(data.bobines.totalElements);
        this.fournisseurs.set(data.fournisseurs);
        this.lots.set(data.lots.content);
        this.resume.set(data.resume);
        this.chargement.set(false);
      },
      error: err => {
        this.erreur.set(err?.error?.message ?? 'Impossible de charger le tableau de bord.');
        this.chargement.set(false);
      }
    });
  }

  // ── Lecture d'une ligne de résumé ──

  reserve(s: ComponentStockSummary): number {
    return s.totalQuantityReserved ?? 0;
  }

  /**
   * Ce que les autres projets peuvent encore prendre.
   *
   * Le serveur envoie le détail par état de bobine ; on retombe sur le calcul
   * brut pour les stocks créés avant les réservations, où le champ manque.
   */
  disponible(s: ComponentStockSummary): number {
    const detaille = (s.intactQuantityAvailable ?? 0) + (s.ouvertQuantityAvailable ?? 0);
    if (detaille > 0) return detaille;
    return Math.max(0, s.totalQuantityRemaining - this.reserve(s));
  }

  /** Part engagée d'une référence, pour la barre de la liste. */
  partReservee(s: ComponentStockSummary): number {
    const physique = s.totalQuantityRemaining;
    if (physique <= 0) return 0;
    return Math.min(100, Math.round((this.reserve(s) / physique) * 100));
  }

  /** Les références les plus tendues d'abord : sous seuil, puis les plus engagées. */
  readonly aSurveiller = computed(() =>
    [...this.resume()]
      .filter(s => s.belowThreshold || this.reserve(s) > 0)
      .sort((a, b) => {
        if (a.belowThreshold !== b.belowThreshold) return a.belowThreshold ? -1 : 1;
        return this.partReservee(b) - this.partReservee(a);
      })
      .slice(0, 8));

  statutLot(lot: Lot): { label: string; couleur: string } {
    if (lot.status === 'RECU') return { label: 'Reçu', couleur: 'var(--success)' };
    if (lot.status === 'PARTIELLEMENT_RECU') return { label: 'Partiel', couleur: 'var(--warning)' };
    return { label: 'Commandé', couleur: 'var(--primary)' };
  }

  enRetard(lot: Lot): boolean {
    return !!lot.estimatedDeliveryDate
      && lot.status !== 'RECU'
      && new Date(lot.estimatedDeliveryDate).getTime() < Date.now();
  }

  joursDeRetard(lot: Lot): number {
    if (!lot.estimatedDeliveryDate) return 0;
    const ms = Date.now() - new Date(lot.estimatedDeliveryDate).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }
}
