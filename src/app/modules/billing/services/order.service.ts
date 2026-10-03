import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CheckoutRequest,
  Order,
  OrderStage,
  Priorite,
  ShippingRate
} from '../models/order.models';

/**
 * Commandes — côté client comme côté atelier.
 *
 * Les deux publics appellent les mêmes routes : le serveur décide de ce que
 * chacun voit d'après son jeton. Un client ne reçoit que ses commandes, un
 * interne celles qui lui sont confiées, et seule l'administration reçoit tout.
 * Le front n'a donc aucun filtrage de sécurité à faire — et ne doit pas
 * prétendre en faire un.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = environment.services.gateway + environment.apiVersion + '/billing/orders';
  private shippingBase = environment.services.gateway + environment.apiVersion + '/billing/shipping';

  // ─── Client ───

  checkout(req: CheckoutRequest): Observable<Order> {
    return this.http.post<Order>(this.base + '/checkout', req);
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.base);
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(this.base + '/' + id);
  }

  /** Le chemin qu'emprunte un chef de projet : depuis la fiche projet. */
  getOrdersByProject(projectId: string): Observable<Order[]> {
    return this.http.get<Order[]>(this.base + '/project/' + projectId);
  }

  // ─── Atelier ───

  getBoard(priorite?: Priorite): Observable<Order[]> {
    let params = new HttpParams();
    if (priorite) params = params.set('priorite', priorite);
    return this.http.get<Order[]>(this.base + '/board', { params });
  }

  /**
   * Déplace une commande d'une colonne à l'autre.
   *
   * La note n'est obligatoire que sur un retour en arrière, et c'est le
   * serveur qui le vérifie : lui seul connaît l'étape de départ réelle, celle
   * que l'écran peut avoir en retard.
   */
  moveStage(id: string, stage: OrderStage, note?: string): Observable<Order> {
    return this.http.put<Order>(this.base + '/' + id + '/stage', { stage, note });
  }

  ship(id: string, transporteur: string, trackingNumber: string): Observable<Order> {
    return this.http.put<Order>(this.base + '/' + id + '/ship', { transporteur, trackingNumber });
  }

  changePriorite(id: string, priorite: Priorite, motif: string): Observable<Order> {
    return this.http.put<Order>(this.base + '/' + id + '/priorite', { priorite, motif });
  }

  assignTechnician(id: string, technicienId: string): Observable<Order> {
    return this.http.put<Order>(this.base + '/' + id + '/technicien', { technicienId });
  }

  // ─── Grille tarifaire (admin) ───

  getShippingRates(): Observable<ShippingRate[]> {
    return this.http.get<ShippingRate[]>(this.shippingBase + '/rates');
  }

  updateShippingRate(rate: ShippingRate): Observable<ShippingRate> {
    return this.http.put<ShippingRate>(this.shippingBase + '/rates/' + rate.id, rate);
  }
}
