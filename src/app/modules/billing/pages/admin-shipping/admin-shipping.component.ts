import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { ShippingMethod, ShippingRate } from '../../models/order.models';

/**
 * La grille de frais de livraison, éditable par l'administrateur.
 *
 * Les tarifs des transporteurs bougent ; le code, non. Cette page existe pour
 * qu'une hausse se répercute en une minute sur les commandes suivantes, sans
 * redéploiement et sans qu'un développeur ait à toucher au chiffrage.
 *
 * Les bornes de poids ne sont pas modifiables : les déplacer creuserait un
 * trou ou un recouvrement dans la grille, et une commande tomberait alors dans
 * aucune tranche ou dans deux.
 */
@Component({
  selector: 'app-admin-shipping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-shipping.component.html'
})
export class AdminShippingComponent implements OnInit {
  private orderService = inject(OrderService);

  rates = signal<ShippingRate[]>([]);
  loading = signal(true);
  savingId = signal<string | null>(null);
  error = signal<string | null>(null);
  saved = signal<string | null>(null);

  readonly standard = computed(() => this.byMethod('STANDARD'));
  readonly express = computed(() => this.byMethod('EXPRESS'));

  private byMethod(method: ShippingMethod): ShippingRate[] {
    return this.rates()
      .filter(r => r.method === method)
      .sort((a, b) => a.poidsMinKg - b.poidsMinKg);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.orderService.getShippingRates().subscribe({
      next: rates => {
        this.rates.set(rates);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Impossible de charger la grille.');
        this.loading.set(false);
      }
    });
  }

  save(rate: ShippingRate): void {
    if (!rate.id) return;
    this.savingId.set(rate.id);
    this.error.set(null);

    this.orderService.updateShippingRate(rate).subscribe({
      next: maj => {
        this.rates.update(list => list.map(r => r.id === maj.id ? maj : r));
        this.savingId.set(null);
        this.saved.set(maj.id!);
        setTimeout(() => this.saved.set(null), 2400);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Enregistrement refusé.');
        this.savingId.set(null);
      }
    });
  }

  trancheLabel(rate: ShippingRate): string {
    return rate.poidsMaxKg == null
      ? `${rate.poidsMinKg} kg et plus`
      : `${rate.poidsMinKg} – ${rate.poidsMaxKg} kg`;
  }

  /**
   * Poids d'une commande type, pour donner une idée de ce que couvre la
   * tranche. Une carte assemblée de 100 × 80 mm pèse environ 32 g.
   */
  exempleCartes(rate: ShippingRate): string {
    const min = Math.ceil((rate.poidsMinKg * 1000) / 32);
    if (rate.poidsMaxKg == null) return `au-delà de ${min} cartes moyennes`;
    const max = Math.floor((rate.poidsMaxKg * 1000) / 32);
    return `environ ${Math.max(1, min)} à ${max} cartes moyennes`;
  }
}
