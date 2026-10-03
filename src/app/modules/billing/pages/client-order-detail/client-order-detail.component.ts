import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';
import {
  ORDER_STAGES,
  Order,
  OrderStage,
  STAGE_META,
  StageHistory,
  StageMeta
} from '../../models/order.models';

interface TimelineStep {
  meta: StageMeta;
  /** L'étape a été atteinte : elle est derrière nous ou en cours. */
  reached: boolean;
  /** L'étape est celle où la commande se trouve maintenant. */
  active: boolean;
  /** Quand la commande est entrée dans cette étape. */
  at: string | null;
  /** Note laissée lors d'un retour en arrière sur cette étape. */
  note: string | null;
}

/**
 * Le suivi d'une commande, vu par son client.
 *
 * La timeline n'est pas une donnée à part : elle se lit dans l'historique des
 * déplacements du tableau d'atelier. Chaque fois qu'un technicien fait glisser
 * la carte d'une colonne à l'autre, le client gagne un point daté. Il n'y a
 * donc rien à tenir à jour en double, et rien qui puisse diverger.
 */
@Component({
  selector: 'app-client-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-order-detail.component.html'
})
export class ClientOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly stages = ORDER_STAGES;

  /**
   * Les cinq étapes, enrichies de ce qui leur est arrivé.
   *
   * Une commande annulée n'a pas d'étape active : la laisser clignoter en
   * « assemblage » ferait croire à une fabrication en cours.
   */
  readonly steps = computed<TimelineStep[]>(() => {
    const order = this.order();
    if (!order) return [];

    const courante = ORDER_STAGES.indexOf(order.stage);
    const annulee = order.status === 'CANCELLED';

    return ORDER_STAGES.map((stage, index) => ({
      meta: STAGE_META[stage],
      reached: index <= courante && !annulee,
      active: index === courante && !annulee && order.status !== 'DELIVERED',
      at: this.enteredAt(order, stage),
      note: this.noteFor(order, stage)
    }));
  });

  /** Hauteur du trait de progression, en pourcentage de la colonne. */
  readonly progressPercent = computed(() => {
    const order = this.order();
    if (!order || order.status === 'CANCELLED') return 0;
    const index = ORDER_STAGES.indexOf(order.stage);
    return ((index + 0.5) / ORDER_STAGES.length) * 100;
  });

  readonly livree = computed(() => this.order()?.status === 'DELIVERED');
  readonly annulee = computed(() => this.order()?.status === 'CANCELLED');
  readonly enAttentePaiement = computed(() => this.order()?.status === 'PENDING_PAYMENT');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Commande introuvable.');
      this.loading.set(false);
      return;
    }
    this.orderService.getOrder(id).subscribe({
      next: order => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Cette commande est introuvable.');
        this.loading.set(false);
      }
    });
  }

  /**
   * Date d'entrée dans une étape.
   *
   * La première étape n'a pas de mouvement qui y mène — la commande y naît au
   * paiement, c'est donc cette date-là qui fait foi.
   */
  private enteredAt(order: Order, stage: OrderStage): string | null {
    if (stage === 'EN_ATTENTE') {
      return order.paidAt ?? order.placedAt ?? null;
    }
    const mouvement = (order.stageHistory ?? [])
      .filter(h => h.to === stage)
      .sort((a, b) => a.movedAt.localeCompare(b.movedAt))
      .pop();
    return mouvement?.movedAt ?? null;
  }

  /**
   * Note d'un retour en arrière sur cette étape.
   *
   * Un retour signale un défaut constaté : le client a le droit de savoir
   * pourquoi sa commande a reculé, plutôt que de voir une date disparaître.
   */
  private noteFor(order: Order, stage: OrderStage): string | null {
    const retour = (order.stageHistory ?? [])
      .filter(h => h.to === stage && this.estUnRetour(h))
      .pop();
    return retour?.note ?? null;
  }

  private estUnRetour(h: StageHistory): boolean {
    return ORDER_STAGES.indexOf(h.to) < ORDER_STAGES.indexOf(h.from);
  }

  get totalCartes(): number {
    return (this.order()?.lines ?? []).reduce((total, l) => total + l.quantity, 0);
  }
}
