import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartLine } from '../../models/order.models';

/**
 * Le panier : les devis que le client a décidé de commander ensemble.
 *
 * Aucun frais de livraison n'y figure, et c'est volontaire — le mode de
 * livraison se choisit au checkout, une fois le contenu arrêté. Afficher un
 * total « livraison comprise » avant ce choix reviendrait à en supposer un.
 */
@Component({
  selector: 'app-client-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-cart.component.html'
})
export class ClientCartComponent implements OnInit {
  private cartService = inject(CartService);
  private router = inject(Router);

  readonly cart = this.cartService.cart;
  readonly poidsKg = this.cartService.poidsKg;

  loading = signal(true);
  /** Identifiant de la ligne en cours de modification — le reste reste actif. */
  busyLine = signal<string | null>(null);
  error = signal<string | null>(null);

  readonly lines = computed(() => this.cart()?.lines ?? []);
  readonly currency = computed(() => this.cart()?.currency ?? 'TND');

  readonly totalCartes = computed(() =>
    this.lines().reduce((total, l) => total + l.quantity, 0));

  /**
   * Une seule carte sans dimensions rend le poids du colis inconnu. On préfère
   * le dire que d'annoncer un chiffre partiel, qui serait crédible et faux.
   */
  readonly poidsIncomplet = computed(() =>
    this.lines().length > 0 && this.lines().some(l => l.poidsUnitaireG == null));

  /**
   * Les projets dont le contrat n'est pas encore revenu signe.
   *
   * Le serveur refuse le checkout tant qu'il en reste un. L'annoncer ici evite
   * au client de remplir une adresse de livraison pour se faire arreter a la
   * derniere etape, sans comprendre ce qui manque.
   */
  readonly contratsManquants = this.cartService.contratsManquants;
  readonly livraisonOfferte = this.cartService.livraisonOfferte;
  readonly resteAvantFranco = this.cartService.resteAvantFranco;
  readonly seuilFranco = this.cartService.seuilFranco;
  readonly pretACommander = this.cartService.pretACommander;

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.cartService.load().subscribe({
      next: () => this.loading.set(false),
      error: err => {
        this.error.set(this.messageOf(err));
        this.loading.set(false);
      }
    });
  }

  remove(line: CartLine): void {
    this.busyLine.set(line.lineId);
    this.cartService.removeItem(line.lineId).subscribe({
      next: () => this.busyLine.set(null),
      error: err => {
        this.error.set(this.messageOf(err));
        this.busyLine.set(null);
      }
    });
  }

  goToCheckout(): void {
    this.router.navigate(['/client/checkout']);
  }

  poidsLigneKg(line: CartLine): number | null {
    return line.poidsUnitaireG == null
      ? null
      : (line.poidsUnitaireG * line.quantity) / 1000;
  }

  private messageOf(err: any): string {
    return err?.error?.message
      ?? err?.error?.error
      ?? 'Une erreur est survenue. Réessayez dans un instant.';
  }
}
