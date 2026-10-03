import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrderService } from '../../../../modules/billing/services/order.service';
import { ProductionStockService } from '../../../../modules/stock/services/production-stock.service';
import { StorageLocationService } from '../../../../modules/stock/services/storage-location.service';
import { KittingLine, StorageLocation } from '../../../../modules/stock/models/stock.models';
import { Order } from '../../../../modules/billing/models/order.models';

/**
 * Préparation des bobines — l'écran de kitting d'un projet.
 *
 * Le technicien ne choisit pas les bobines et n'en compte pas les pièces :
 * la réservation, écrite au paiement, sait déjà quoi prendre et combien.
 * Il lit cette liste, il va chercher, il rend. C'est au retour — et là
 * seulement — que le stock baisse.
 *
 * Une page et non un panneau : la préparation est un poste de travail, pas
 * une confirmation. Elle se garde ouverte le temps d'aller au magasin, se
 * recharge sans repasser par le tableau, et son adresse se partage.
 */
@Component({
  selector: 'app-production-kitting',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './kitting.component.html'
})
export class ProductionKittingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private productionStock = inject(ProductionStockService);
  private locationService = inject(StorageLocationService);

  /** La commande qui porte le projet préparé. */
  order = signal<Order | null>(null);
  orderLoading = signal(true);
  error = signal<string | null>(null);

  /** Le projet dont on prépare les bobines — une commande peut en grouper plusieurs. */
  projetId = signal<string | null>(null);

  kitting = signal<KittingLine[]>([]);
  kittingLoading = signal(false);
  kittingError = signal<string | null>(null);
  kittingInfo = signal<string | null>(null);
  actionEnCours = signal(false);

  /** Bobines cochées, par identifiant. */
  selection = new Set<string>();

  /** Case de rangement choisie pour chaque bobine qui revient. */
  destinations: Record<string, string> = {};

  /** Cases libres de l'atelier — une bobine entamée ne remonte pas au magasin. */
  casesProduction = signal<StorageLocation[]>([]);

  readonly lignesCommande = computed(() => this.order()?.lines ?? []);

  readonly projetNom = computed(() => {
    const id = this.projetId();
    return this.lignesCommande().find(l => l.projectId === id)?.projectName ?? '—';
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.error.set('Commande introuvable.');
      this.orderLoading.set(false);
      return;
    }

    this.orderService.getOrder(orderId).subscribe({
      next: order => {
        this.order.set(order);
        this.orderLoading.set(false);

        // Le projet demandé par l'URL s'il figure encore dans la commande, le
        // premier sinon : un lien vieilli ouvre l'écran plutôt que rien.
        const demande = this.route.snapshot.queryParamMap.get('projet');
        const lignes = order.lines ?? [];
        const ligne = lignes.find(l => l.projectId === demande) ?? lignes[0];
        if (!ligne) {
          this.error.set("Cette commande n'est rattachée à aucun projet.");
          return;
        }
        this.projetId.set(ligne.projectId);
        this.chargerKitting();
        this.chargerCasesProduction();
      },
      error: err => {
        this.error.set(this.messageOf(err));
        this.orderLoading.set(false);
      }
    });
  }

  /** Bascule vers un autre projet de la même commande. */
  changerProjet(projetId: string): void {
    if (projetId === this.projetId()) return;
    this.projetId.set(projetId);
    this.selection.clear();
    this.destinations = {};
    this.kittingInfo.set(null);
    this.kittingError.set(null);
    // L'adresse suit le projet affiché : un rechargement rouvre le même.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { projet: projetId },
      replaceUrl: true
    });
    this.chargerKitting();
  }

  chargerKitting(): void {
    const projetId = this.projetId();
    if (!projetId) return;

    this.kittingLoading.set(true);
    this.kittingError.set(null);
    this.productionStock.kittingList(projetId).subscribe({
      next: lignes => {
        this.kitting.set(lignes);
        this.kittingLoading.set(false);
      },
      error: err => {
        this.kittingError.set(this.messageOf(err));
        this.kittingLoading.set(false);
      }
    });
  }

  private chargerCasesProduction(): void {
    this.locationService.getLocations('PRODUCTION').subscribe({
      next: cases => this.casesProduction.set(cases.filter(c => c.slotStatus === 'LIBRE')),
      error: () => this.casesProduction.set([])
    });
  }

  /**
   * Les cases encore proposables pour une bobine.
   *
   * Une case ne tient qu'une bobine — le serveur le vérifie et refuse la
   * seconde. Mais il la refuse au moment du retour, une fois la série lancée :
   * le technicien voyait alors quatre bobines rendues et la cinquième en
   * erreur, sans comprendre qu'il avait choisi deux fois la même case dix
   * lignes plus haut.
   *
   * On retire donc de la liste ce qui est déjà pris par une autre ligne du
   * même formulaire. La case reste visible sur la ligne qui l'a choisie, sinon
   * le select afficherait un vide à la place de la sélection en cours.
   */
  casesPour(reelId: string): StorageLocation[] {
    const prises = new Set(
      Object.entries(this.destinations)
        .filter(([id, caseId]) => id !== reelId && !!caseId)
        .map(([, caseId]) => caseId));

    return this.casesProduction().filter(c => !prises.has(c.id));
  }

  /** Ce qu'il reste à aller chercher — magasin ou stock production. */
  readonly aSortir = computed(() =>
    this.kitting().filter(l => l.actionable && l.mountType !== 'THT'));

  /** Ce qui est sur une machine et doit revenir : c'est là que le stock baisse. */
  readonly aRendre = computed(() =>
    this.kitting().filter(l => l.state === 'EN_MACHINE' && !l.consumed));

  /** Les traversants : pas de machine, pas de retour — on prend et c'est fait. */
  readonly traversants = computed(() =>
    this.kitting().filter(l => l.mountType === 'THT' && !l.consumed && l.state !== 'EPUISEE'));

  /** Retenues par un autre projet : à attendre, pas à remplacer. */
  readonly bloquees = computed(() =>
    this.kitting().filter(l => l.state === 'OCCUPEE'));

  /** Bobines déjà consommées / décomptées. */
  readonly consommees = computed(() =>
    this.kitting().filter(l => l.consumed));

  readonly totalPiecesProjet = computed(() =>
    this.kitting().reduce((total, l) => total + l.quantityForProject, 0));

  basculer(reelId: string): void {
    if (this.selection.has(reelId)) {
      this.selection.delete(reelId);
    } else {
      this.selection.add(reelId);
    }
  }

  estSelectionnee(reelId: string): boolean {
    return this.selection.has(reelId);
  }

  toutSelectionner(lignes: KittingLine[]): void {
    const toutes = lignes.every(l => this.selection.has(l.reelId));
    lignes.forEach(l => toutes ? this.selection.delete(l.reelId) : this.selection.add(l.reelId));
  }

  selectionDans(lignes: KittingLine[]): number {
    return lignes.filter(l => this.selection.has(l.reelId)).length;
  }

  /** Les bobines partent en machine. Rien n'est décompté : elles reviendront. */
  sortir(): void {
    const projetId = this.projetId();
    const reelIds = this.aSortir()
      .filter(l => this.selection.has(l.reelId))
      .map(l => l.reelId);
    if (!projetId || reelIds.length === 0) return;

    this.actionEnCours.set(true);
    this.productionStock.issue(projetId, { reelIds }).subscribe({
      next: resultat => {
        this.actionEnCours.set(false);
        this.selection.clear();
        this.rapporter(resultat.succeeded, resultat.failed,
          resultat.succeeded + ' bobine(s) sortie(s) vers la production', resultat.results);
        this.chargerKitting();
      },
      error: err => {
        this.actionEnCours.set(false);
        this.kittingError.set(this.messageOf(err));
      }
    });
  }

  /**
   * Les bobines reviennent, rangées dans une case atelier.
   *
   * C'est le seul geste qui fait baisser le stock : le serveur retire de
   * chaque bobine la quantité que le projet y avait réservée, et le reste
   * redevient disponible pour les autres projets.
   */
  rendre(): void {
    const projetId = this.projetId();
    const items = this.aRendre()
      .filter(l => this.selection.has(l.reelId))
      .map(l => ({ reelId: l.reelId, toLocationId: this.destinations[l.reelId] || undefined }));
    if (!projetId || items.length === 0) return;

    this.actionEnCours.set(true);
    this.productionStock.returnToProdStock(projetId, { items }).subscribe({
      next: resultat => {
        this.actionEnCours.set(false);
        this.selection.clear();
        // La case d'une bobine rendue n'a plus a bloquer les autres lignes :
        // sans cet oubli, un second retour ne proposait plus rien.
        resultat.results.filter(r => r.ok).forEach(r => delete this.destinations[r.reelId]);
        const pieces = resultat.results
          .filter(r => r.ok)
          .reduce((total, r) => total + r.quantity, 0);
        this.rapporter(resultat.succeeded, resultat.failed,
          resultat.succeeded + ' bobine(s) rendue(s) — ' + pieces + ' pièce(s) décomptée(s)',
          resultat.results);
        this.chargerKitting();
        this.chargerCasesProduction();
      },
      error: err => {
        this.actionEnCours.set(false);
        this.kittingError.set(this.messageOf(err));
      }
    });
  }

  /** Traversant : la sortie est la consommation, il n'y a rien à attendre. */
  sortirTraversant(ligne: KittingLine): void {
    const projetId = this.projetId();
    if (!projetId) return;

    this.actionEnCours.set(true);
    this.productionStock.issueTht(projetId, {
      reelId: ligne.reelId,
      quantity: ligne.quantityForProject
    }).subscribe({
      next: resultat => {
        this.actionEnCours.set(false);
        this.rapporter(resultat.succeeded, resultat.failed,
          ligne.quantityForProject + ' pièce(s) sorties de ' + ligne.serialnumber,
          resultat.results);
        this.chargerKitting();
      },
      error: err => {
        this.actionEnCours.set(false);
        this.kittingError.set(this.messageOf(err));
      }
    });
  }

  /**
   * Le serveur ne s'arrête pas à la première bobine en défaut : quatre
   * bobines valides partent même si la cinquième est retenue. On rapporte
   * donc les deux — ce qui est passé, et pourquoi le reste ne l'est pas.
   */
  private rapporter(succes: number, echecs: number, message: string,
                    resultats: Array<{ ok: boolean; serialnumber?: string; message?: string }>): void {
    this.kittingInfo.set(succes > 0 ? message : null);
    const refus = resultats.filter(r => !r.ok);
    this.kittingError.set(echecs > 0
      ? refus.map(r => (r.serialnumber ?? 'Bobine') + ' : ' + r.message).join(' · ')
      : null);
  }

  etatLabel(state: KittingLine['state']): string {
    switch (state) {
      case 'EN_MAGASIN':          return 'Magasin';
      case 'EN_STOCK_PRODUCTION': return 'Stock production';
      case 'EN_MACHINE':          return 'En machine';
      case 'OCCUPEE':             return 'Retenue';
      default:                    return 'Vide';
    }
  }

  etatCouleur(state: KittingLine['state']): string {
    switch (state) {
      case 'EN_MAGASIN':          return 'var(--success)';
      case 'EN_STOCK_PRODUCTION': return 'var(--primary)';
      case 'EN_MACHINE':          return 'var(--accent)';
      case 'OCCUPEE':             return 'var(--destructive)';
      default:                    return 'var(--muted-foreground)';
    }
  }

  /** Depuis combien de jours une bobine est retenue — ce qui dort se voit. */
  joursRetenue(ligne: KittingLine): number {
    if (!ligne.issuedToProductionAt) return 0;
    const ms = Date.now() - new Date(ligne.issuedToProductionAt).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  private messageOf(err: any): string {
    return err?.error?.message
      ?? err?.error?.error
      ?? "La préparation n'a pas pu être chargée. Rechargez la page.";
  }
}
