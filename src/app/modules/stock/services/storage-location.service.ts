import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { StorageLocation, StorageLocationRequest, WarehouseType } from '../models/stock.models';

@Injectable({ providedIn: 'root' })
export class StorageLocationService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/locations`;

  getLocations(warehouse?: WarehouseType, zone?: string): Observable<StorageLocation[]> {
    let params = new HttpParams();
    if (warehouse) params = params.set('warehouse', warehouse);
    if (zone) params = params.set('zone', zone);
    return this.http.get<StorageLocation[]>(this.base, { params });
  }
  getLocation(id: string): Observable<StorageLocation> { return this.http.get<StorageLocation>(`${this.base}/${id}`); }
  create(req: StorageLocationRequest): Observable<StorageLocation> { return this.http.post<StorageLocation>(this.base, req); }
  update(id: string, req: StorageLocationRequest): Observable<StorageLocation> { return this.http.put<StorageLocation>(`${this.base}/${id}`, req); }
  updateStatus(id: string, slotStatus: 'LIBRE' | 'OCCUPE' | 'CIBLE_ACTIVE'): Observable<StorageLocation> {
    return this.http.patch<StorageLocation>(`${this.base}/${id}/status`, { slotStatus });
  }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
