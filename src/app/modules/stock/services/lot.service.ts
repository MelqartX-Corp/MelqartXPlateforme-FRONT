import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Lot, LotRequest, LotReceptionRequest } from '../models/stock.models';
import { Page } from '../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class LotService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/lots`;

  getLots(page = 0, size = 20): Observable<Page<Lot>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Lot>>(this.base, { params });
  }
  getLot(id: string): Observable<Lot> { return this.http.get<Lot>(`${this.base}/${id}`); }
  create(req: LotRequest): Observable<Lot> { return this.http.post<Lot>(this.base, req); }
  update(id: string, req: LotRequest): Observable<Lot> { return this.http.put<Lot>(`${this.base}/${id}`, req); }
  receiveLot(id: string, req: LotReceptionRequest): Observable<Lot> {
    return this.http.post<Lot>(`${this.base}/${id}/receive`, req);
  }
}

