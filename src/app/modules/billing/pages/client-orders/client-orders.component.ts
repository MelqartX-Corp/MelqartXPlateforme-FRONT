import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrderService } from '../../services/order.service';
import {
  ORDER_STAGES,
  Order,
  OrderStatus,
  STAGE_META
} from '../../models/order.models';

/**
 * La liste des commandes.
 *
 * Le même écran sert au client et aux internes : le serveur décide de ce que
 * chacun reçoit d'après son jeton — ses propres commandes pour un client,
 * celles de ses projets pour un chef de projet, toutes pour l'administration.
 * Le front n'ajoute aucun filtrage de sécurité, et ne doit pas prétendre en
 * ajouter un : ce serait une garantie de façade.
 */
@Component({
  selector: 'app-client-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-orders.component.html'
})
export class ClientOrdersComponent implements OnInit {
  private orderService = inject(OrderService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filtre = signal<'TOUTES' | 'EN_COURS' | 'LIVREES'>('TOUTES');

  readonly stageMeta = STAGE_META;

  /**
   * Les cinq etapes deja resolues, dans l'ordre.
   *
   * Le gabarit lit un tableau plutot qu'il n'indexe un dictionnaire : indexer
   * par une chaine libre lui ferait perdre le typage et ouvrirait la porte a
   * une etape qui n'existe pas.
   */
  readonly stageList = ORDER_STAGES.map(stage => STAGE_META[stage]);

  readonly visibles = computed(() => {
    const filtre = this.filtre();
    return this.orders().filter(order => {
      if (filtre === 'LIVREES') return order.status === 'DELIVERED';
      if (filtre === 'EN_COURS') {
        return order.status === 'PAID'
          || order.status === 'SHIPPED'
          || order.status === 'PENDING_PAYMENT';
      }
      return true;
    });
  });

  readonly enCours = computed(() =>
    this.orders().filter(o => o.status === 'PAID' || o.status === 'SHIPPED').length);

  readonly aRegler = computed(() =>
    this.orders().filter(o => o.status === 'PENDING_PAYMENT').length);

  ngOnInit(): void {
    this.orderService.getOrders().subscribe({
      next: orders => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Impossible de charger vos commandes.');
        this.loading.set(false);
      }
    });
  }

  /** Position dans les cinq étapes, en pourcentage — pour la barre de la carte. */
  avancement(order: Order): number {
    if (order.status === 'CANCELLED') return 0;
    if (order.status === 'DELIVERED') return 100;
    const index = ORDER_STAGES.indexOf(order.stage);
    return ((index + 1) / ORDER_STAGES.length) * 100;
  }

  statutLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDING_PAYMENT': return 'À régler';
      case 'PAID':            return 'En production';
      case 'SHIPPED':         return 'Expédiée';
      case 'DELIVERED':       return 'Livrée';
      case 'CANCELLED':       return 'Annulée';
    }
  }

  statutBadge(status: OrderStatus): string {
    switch (status) {
      case 'PENDING_PAYMENT': return 'badge-glow-warning';
      case 'PAID':            return 'badge-glow-primary';
      case 'SHIPPED':         return 'badge-glow-accent';
      case 'DELIVERED':       return 'badge-glow-success';
      case 'CANCELLED':       return 'badge-glow-destructive';
    }
  }

  totalCartes(order: Order): number {
    return (order.lines ?? []).reduce((total, l) => total + l.quantity, 0);
  }

  projetsLabel(order: Order): string {
    const lines = order.lines ?? [];
    if (lines.length === 0) return '—';
    if (lines.length === 1) return lines[0].projectName;
    return `${lines[0].projectName} et ${lines.length - 1} autre(s)`;
  }
}
