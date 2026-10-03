import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { OrderService } from '../../../modules/billing/services/order.service';
import { ProductionStockService } from '../../../modules/stock/services/production-stock.service';
import { KittingLine } from '../../../modules/stock/models/stock.models';
import { Order, OrderStage, ORDER_STAGES } from '../../../modules/billing/models/order.models';

/** Une colonne du flux, avec ce qu'elle porte. */
interface ChargeColonne {
  stage: OrderStage;
  titre: string;
  couleur: string;
  commandes: Order[];
}

/**
 * Tableau de bord du technicien.
 *
 * Il ne lui montre ni devis ni factures : le technicien n'achète rien. Ce
 * qu'il a besoin de savoir en arrivant tient en trois questions — qu'est-ce
 * qui m'attend, qu'est-ce qui presse, et qu'est-ce que j'ai laissé sur une
 * machine hier.
 *
 * La dernière est la moins visible et la plus coûteuse : une bobine oubliée
 * sur un chargeur immobilise ses pièces pour tous les autres projets, et rien
 * dans l'atelier ne vient le rappeler.
 *
 * Toutes les données sont déjà filtrées par le serveur : le tableau ne rend
 * que les commandes affectées à ce technicien.
 */
@Component({
  selector: 'app-technicien-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class TechnicienDashboardComponent implements OnInit {
  private orderService = inject(OrderService);
  private productionStock = inject(ProductionStockService);

  chargement = signal(true);
  erreur = signal<string | null>(null);

  commandes = signal<Order[]>([]);
  /** Bobines actuellement sur une machine — tous projets confondus. */
  enMachine = signal<KittingLine[]>([]);

  private readonly definition: Omit<ChargeColonne, 'commandes'>[] = [
    { stage: 'EN_ATTENTE',       titre: 'En attente',       couleur: 'var(--warning)' },
    { stage: 'FABRICATION',      titre: 'Fabrication',      couleur: 'var(--primary)' },
    { stage: 'ASSEMBLAGE',       titre: 'Assemblage',       couleur: 'var(--accent)' },
    { stage: 'CONTROLE_QUALITE', titre: 'Contrôle qualité', couleur: 'var(--success)' },
    { stage: 'EXPEDITION',       titre: 'Expédition',       couleur: '270 60% 55%' }
  ];

  readonly colonnes = computed<ChargeColonne[]>(() =>
    this.definition.map(c => ({
      ...c,
      commandes: this.commandes().filter(o => o.stage === c.stage)
    })));

  readonly total = computed(() => this.commandes().length);

  readonly urgentes = computed(() =>
    this.commandes().filter(o => o.priorite === 'HAUTE'));

  /** Réglées, pas encore lancées : la file à attaquer en premier. */
  readonly aLancer = computed(() =>
    this.commandes().filter(o => o.stage === 'EN_ATTENTE'));

  /** En cours d'atelier — tout ce qui est entre le lancement et l'expédition. */
  readonly enCours = computed(() =>
    this.commandes().filter(o =>
      o.stage !== 'EN_ATTENTE' && o.stage !== 'EXPEDITION'));

  readonly totalCartes = computed(() =>
    this.commandes().reduce((total, o) => total + this.cartesDe(o), 0));

  /**
   * Bobines sorties depuis plus de deux jours.
   *
   * Le seuil n'est pas une règle d'atelier : c'est le moment où l'oubli
   * devient plus probable que la production en cours.
   */
  readonly bobinesDormantes = computed(() =>
    this.enMachine().filter(l => this.joursEnMachine(l) >= 2));

  /** Ce que les bobines en machine immobilisent, en pièces. */
  readonly piecesImmobilisees = computed(() =>
    this.enMachine().reduce((total, l) => total + l.quantityForProject, 0));

  /** Les plus pressées d'abord, puis les plus anciennes en file. */
  readonly aTraiter = computed(() =>
    [...this.commandes()]
      .filter(o => o.stage !== 'EXPEDITION')
      .sort((a, b) => {
        const rang = (o: Order) => o.priorite === 'HAUTE' ? 0 : o.priorite === 'MOYENNE' ? 1 : 2;
        if (rang(a) !== rang(b)) return rang(a) - rang(b);
        return this.joursEnFile(b) - this.joursEnFile(a);
      })
      .slice(0, 6));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);

    forkJoin({
      commandes: this.orderService.getBoard(),
      // L'écran reste utile si le stock ne répond pas : la charge d'atelier
      // ne dépend pas des bobines, et l'inverse non plus.
      machine: this.productionStock.inMachine().pipe(catchError(() => of([] as KittingLine[])))
    }).subscribe({
      next: data => {
        this.commandes.set(data.commandes);
        this.enMachine.set(data.machine);
        this.chargement.set(false);
      },
      error: err => {
        this.erreur.set(err?.error?.message ?? 'Impossible de charger votre atelier.');
        this.chargement.set(false);
      }
    });
  }

  // ── Mise en forme ──

  cartesDe(order: Order): number {
    return (order.lines ?? []).reduce((total, l) => total + l.quantity, 0);
  }

  projetsLabel(order: Order): string {
    const lines = order.lines ?? [];
    if (lines.length === 0) return '—';
    if (lines.length === 1) return lines[0].projectName;
    return `${lines[0].projectName} +${lines.length - 1}`;
  }

  titreDe(stage: OrderStage): string {
    return this.definition.find(c => c.stage === stage)?.titre ?? stage;
  }

  couleurDe(stage: OrderStage): string {
    return this.definition.find(c => c.stage === stage)?.couleur ?? 'var(--muted-foreground)';
  }

  /** Avancement dans le flux, pour la barre de la carte. */
  avancement(stage: OrderStage): number {
    const index = ORDER_STAGES.indexOf(stage);
    if (index < 0) return 0;
    return Math.round(((index + 1) / ORDER_STAGES.length) * 100);
  }

  prioriteClass(priorite: Order['priorite']): string {
    if (priorite === 'HAUTE') return 'badge-destructive';
    if (priorite === 'MOYENNE') return 'badge-warning';
    return 'badge-muted';
  }

  /** Jours depuis le règlement — ce qui dort se voit. */
  joursEnFile(order: Order): number {
    const debut = order.paidAt ?? order.placedAt;
    if (!debut) return 0;
    return this.joursDepuis(debut);
  }

  joursEnMachine(ligne: KittingLine): number {
    if (!ligne.issuedToProductionAt) return 0;
    return this.joursDepuis(ligne.issuedToProductionAt);
  }

  private joursDepuis(date: string): number {
    const ms = Date.now() - new Date(date).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  /** Le premier projet d'une commande — celui que la préparation ouvre. */
  premierProjet(order: Order): string | null {
    return (order.lines ?? [])[0]?.projectId ?? null;
  }
}
