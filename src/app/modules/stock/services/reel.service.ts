import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Reel, ReelRequest, ComponentStockSummary, ReelProductionState } from '../models/stock.models';
import { Page } from '../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class ReelService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/reels`;

  getReels(page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getByStatus(status: 'INTACT' | 'OUVERT' | 'VIDE', page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('status', status).set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getByLotId(lotId: string, page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('lotId', lotId).set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getByStorageLocationId(locationId: string, page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('storageLocationId', locationId).set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getBySerialNumber(serialnumber: string, page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('serialnumber', serialnumber).set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getStockSummary(): Observable<ComponentStockSummary[]> {
    return this.http.get<ComponentStockSummary[]>(`${this.base}/stats/by-component`);
  }

  /**
   * Filtre par état d'atelier — magasin, stock production, machine, vide.
   *
   * L'atelier ne cherche pas « OUVERT » : il cherche « rangée en production »
   * ou « sur une machine », deux situations que le statut seul confond.
   */
  getByProductionState(state: ReelProductionState, page = 0, size = 20): Observable<Page<Reel>> {
    const params = new HttpParams().set('state', state).set('page', page).set('size', size);
    return this.http.get<Page<Reel>>(this.base, { params });
  }

  getReel(id: string): Observable<Reel> { return this.http.get<Reel>(`${this.base}/${id}`); }
  create(req: ReelRequest): Observable<Reel> { return this.http.post<Reel>(this.base, req); }
  update(id: string, req: Partial<ReelRequest>): Observable<Reel> { return this.http.put<Reel>(`${this.base}/${id}`, req); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
