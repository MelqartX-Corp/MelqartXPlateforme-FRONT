import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AddCartItemRequest,
  CartResponse,
  ShippingQuote
} from '../models/order.models';

/**
 * Le panier du client connecté.
 *
 * Le service garde l'état courant dans un signal plutôt que de le relire à
 * chaque affichage : le badge de la barre de navigation, la page panier et le
 * checkout regardent tous le même panier, et ils doivent tous les trois se
 * mettre à jour au même moment quand une ligne est ajoutée ou retirée.
 *
 * Aucun montant n'est calculé ici. Le serveur renvoie les totaux et les frais
 * de port ; le front les affiche. Recalculer côté client donnerait un deuxième
 * prix, et les deux finiraient par diverger.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private base = environment.services.gateway + environment.apiVersion + '/billing/cart';

  /** null tant que le panier n'a jamais été chargé — différent d'un panier vide. */
  private state = signal<CartResponse | null>(null);

  readonly cart = this.state.asReadonly();
  readonly itemCount = computed(() => this.state()?.itemCount ?? 0);
  readonly isEmpty = computed(() => (this.state()?.lines?.length ?? 0) === 0);
  readonly totalTtc = computed(() => this.state()?.totalTtc ?? 0);

  /** Les contrats qui manquent avant que la commande puisse partir. */
  readonly contratsManquants = computed(() => this.state()?.contratsManquants ?? []);

  /** La livraison standard est-elle offerte pour ce panier ? */
  readonly livraisonOfferte = computed(() => this.state()?.livraisonOfferte ?? false);
  readonly seuilFranco = computed(() => this.state()?.seuilFranco ?? null);
  /** Ce qu'il manque en HT pour y arriver — le seul chiffre qui peut encore
   *  changer la decision du client avant la caisse. */
  readonly resteAvantFranco = computed(() => this.state()?.resteAvantFranco ?? null);

  /** Le panier peut-il passer en caisse ? Non tant qu'un contrat manque. */
  readonly pretACommander = computed(() =>
    !this.isEmpty() && this.contratsManquants().length === 0);

  /** Poids du colis en kg, ou null si une carte au moins n'a pas de Gerber. */
  readonly poidsKg = computed(() => {
    const g = this.state()?.poidsTotalG;
    return g == null ? null : g / 1000;
  });

  load(): Observable<CartResponse> {
    return this.http.get<CartResponse>(this.base).pipe(tap(c => this.state.set(c)));
  }

  addItem(req: AddCartItemRequest): Observable<CartResponse> {
    return this.http.post<CartResponse>(this.base + '/items', req)
      .pipe(tap(c => this.state.set(c)));
  }

  updateQuantity(lineId: string, quantity: number): Observable<CartResponse> {
    return this.http.patch<CartResponse>(this.base + '/items/' + lineId, { quantity })
      .pipe(tap(c => this.state.set(c)));
  }

  removeItem(lineId: string): Observable<CartResponse> {
    return this.http.delete<CartResponse>(this.base + '/items/' + lineId)
      .pipe(tap(c => this.state.set(c)));
  }

  /**
   * Les deux modes de livraison chiffrés pour le panier courant.
   *
   * Renvoyés ensemble : le client compare un prix ET une date, pas une option
   * à la fois.
   */
  shippingOptions(): Observable<ShippingQuote[]> {
    return this.http.get<ShippingQuote[]>(this.base + '/shipping/options');
  }

  /** Après une commande : le panier est vidé côté serveur, l'état suit. */
  clearLocal(): void {
    this.state.update(c => c
      ? { ...c, lines: [], itemCount: 0, totalTtc: 0, poidsTotalG: 0, contratsManquants: [],
          totalHt: 0, livraisonOfferte: false, resteAvantFranco: null }
      : c);
  }
}
