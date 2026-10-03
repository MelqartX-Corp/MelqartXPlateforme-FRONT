import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { OrderService } from '../../../modules/billing/services/order.service';
import {
  ORDER_STAGES,
  Order,
  OrderStage,
  Priorite
} from '../../../modules/billing/models/order.models';

interface Column {
  id: OrderStage;
  title: string;
  icon: string;
  /** Teinte de la colonne, en composantes HSL du thème. */
  color: string;
  orders: Order[];
}

/**
 * Supervision de production — le tableau d'atelier.
 *
 * Cinq colonnes, une carte par commande, et un glisser-déposer pour la faire
 * avancer. Chaque déplacement écrit une ligne d'historique côté serveur, et
 * cette ligne est exactement ce que le client lit comme suivi : l'atelier
 * tient la timeline sans jamais avoir à la saisir.
 *
 * L'écran ne décide de rien. Il affiche ce que le serveur lui confie — et le
 * serveur ne confie à chacun que ce qui lui revient : les commandes qu'on lui
 * a affectées pour un technicien, celles de ses projets pour un chef de
 * projet, toutes pour l'administration.
 */
@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule],
  templateUrl: './production.component.html'
})
export class ProductionComponent implements OnInit {
  private orderService = inject(OrderService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filtrePriorite = signal<Priorite | null>(null);

  /** Commande dont on saisit la note de retour en arrière. */
  retour = signal<{ order: Order; cible: OrderStage } | null>(null);
  noteRetour = '';

  /** Commande dont on saisit le transporteur avant l'expédition. */
  expedition = signal<Order | null>(null);
  transporteur = '';
  trackingNumber = '';

  /** Les cinq colonnes, dans l'ordre du flux de fabrication. */
  private readonly definition: Omit<Column, 'orders'>[] = [
    { id: 'EN_ATTENTE',       title: 'En attente',       icon: 'clock',  color: 'var(--warning)' },
    { id: 'FABRICATION',      title: 'Fabrication',      icon: 'cog',    color: 'var(--primary)' },
    { id: 'ASSEMBLAGE',       title: 'Assemblage',       icon: 'layers', color: 'var(--accent)' },
    { id: 'CONTROLE_QUALITE', title: 'Contrôle qualité', icon: 'check',  color: 'var(--success)' },
    // Derniere colonne : y deposer une carte cloture la commande, et avec elle
    // les projets de fabrication qu'elle porte.
    { id: 'EXPEDITION',       title: 'Expédition',       icon: 'truck',  color: '270 60% 55%' }
  ];

  readonly columns = computed<Column[]>(() =>
    this.definition.map(col => ({
      ...col,
      orders: this.orders().filter(o => o.stage === col.id)
    })));

  readonly connectedLists: string[] = this.definition.map(c => c.id);

  readonly totalOrders = computed(() => this.orders().length);

  readonly urgentes = computed(() =>
    this.orders().filter(o => o.priorite === 'HAUTE').length);

  /** Commandes réglées qui attendent d'être lancées — la file à attaquer. */
  readonly enFile = computed(() =>
    this.orders().filter(o => o.stage === 'EN_ATTENTE').length);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.orderService.getBoard(this.filtrePriorite() ?? undefined).subscribe({
      next: orders => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(this.messageOf(err));
        this.loading.set(false);
      }
    });
  }

  filtrer(priorite: Priorite | null): void {
    this.filtrePriorite.set(priorite);
    this.reload();
  }

  /**
   * Une carte a été lâchée dans une colonne.
   *
   * Deux situations demandent une saisie avant d'appeler le serveur : un
   * retour en arrière exige une note, l'expédition exige un transporteur. Les
   * demander ici plutôt que de laisser le serveur refuser évite au technicien
   * un aller-retour pour rien.
   */
  drop(event: CdkDragDrop<Order[]>, cible: OrderStage): void {
    const order: Order = event.item.data;
    if (!order || order.stage === cible) return;

    const depart = ORDER_STAGES.indexOf(order.stage);
    const arrivee = ORDER_STAGES.indexOf(cible);

    if (arrivee < depart) {
      this.noteRetour = '';
      this.retour.set({ order, cible });
      return;
    }
    if (arrivee > depart + 1) {
      this.error.set(
        `Une commande passe d'une colonne à la suivante : `
        + `${this.titreDe(order.stage)} → ${this.titreDe(cible)} saute une étape.`);
      return;
    }
    if (cible === 'EXPEDITION' && !order.shipping?.trackingNumber) {
      this.transporteur = '';
      this.trackingNumber = '';
      this.expedition.set(order);
      return;
    }

    this.move(order, cible);
  }

  /**
   * Déplacement optimiste : la carte bouge tout de suite, puis se replace si
   * le serveur refuse. Attendre la réponse rendrait le glisser-déposer poisseux
   * sur une connexion d'atelier.
   */
  private move(order: Order, cible: OrderStage, note?: string): void {
    const precedent = order.stage;
    this.appliquerLocalement(order.id, cible);
    this.error.set(null);

    this.orderService.moveStage(order.id, cible, note).subscribe({
      next: maj => this.remplacer(maj),
      error: err => {
        this.appliquerLocalement(order.id, precedent);
        this.error.set(this.messageOf(err));
      }
    });
  }

  private appliquerLocalement(orderId: string, stage: OrderStage): void {
    this.orders.update(list => list.map(o => o.id === orderId ? { ...o, stage } : o));
  }

  private remplacer(maj: Order): void {
    this.orders.update(list => list.map(o => o.id === maj.id ? maj : o));
  }

  // ── Retour en arrière ──

  confirmerRetour(): void {
    const demande = this.retour();
    if (!demande || !this.noteRetour.trim()) return;
    this.move(demande.order, demande.cible, this.noteRetour.trim());
    this.retour.set(null);
  }

  annulerRetour(): void {
    this.retour.set(null);
  }

  // ── Expédition ──

  confirmerExpedition(): void {
    const order = this.expedition();
    if (!order || !this.transporteur.trim() || !this.trackingNumber.trim()) return;

    this.orderService.ship(order.id, this.transporteur.trim(), this.trackingNumber.trim())
      .subscribe({
        next: maj => {
          this.remplacer(maj);
          this.expedition.set(null);
          // Le suivi est enregistré : le passage en colonne peut aboutir.
          this.move(maj, 'EXPEDITION');
        },
        error: err => {
          this.error.set(this.messageOf(err));
          this.expedition.set(null);
        }
      });
  }

  annulerExpedition(): void {
    this.expedition.set(null);
  }

  /**
   * Ouvre la préparation des bobines d'un projet de la commande.
   *
   * Une commande peut grouper plusieurs projets, et les bobines se réservent
   * par projet : on ouvre donc le premier, et la page laisse basculer.
   *
   * La préparation est une page et non une fenêtre : le technicien la garde
   * ouverte le temps d'aller au magasin, et le tableau reste où il était.
   */
  ouvrirPreparation(order: Order, projetId?: string): void {
    const ligne = projetId
      ? (order.lines ?? []).find(l => l.projectId === projetId)
      : (order.lines ?? [])[0];
    if (!ligne) {
      this.error.set("Cette commande n'est rattachée à aucun projet.");
      return;
    }

    this.router.navigate(['/production', order.id, 'kitting'],
      { queryParams: { projet: ligne.projectId } });
  }

  // ── Mise en forme ──

  titreDe(stage: OrderStage): string {
    return this.definition.find(c => c.id === stage)?.title ?? stage;
  }

  priorityClass(priorite: Priorite): string {
    if (priorite === 'HAUTE') return 'badge-destructive';
    if (priorite === 'MOYENNE') return 'badge-warning';
    return 'badge-muted';
  }

  totalCartes(order: Order): number {
    return (order.lines ?? []).reduce((total, l) => total + l.quantity, 0);
  }

  /**
   * Ce que la commande fait fabriquer.
   *
   * Une commande peut grouper plusieurs projets : on nomme le premier et on
   * compte les autres, plutôt que d'étirer la carte ou de tronquer au hasard.
   */
  projetsLabel(order: Order): string {
    const lines = order.lines ?? [];
    if (lines.length === 0) return '—';
    if (lines.length === 1) return lines[0].projectName;
    return `${lines[0].projectName} +${lines.length - 1}`;
  }

  /** Nombre de jours depuis le règlement — sert à repérer ce qui dort. */
  joursEnFile(order: Order): number {
    const debut = order.paidAt ?? order.placedAt;
    if (!debut) return 0;
    const ms = Date.now() - new Date(debut).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  private messageOf(err: any): string {
    return err?.error?.message
      ?? err?.error?.error
      ?? 'Le déplacement a été refusé. Rechargez le tableau.';
  }
}
