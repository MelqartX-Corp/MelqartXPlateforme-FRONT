import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Supplier, SupplierRequest } from '../models/stock.models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/suppliers`;

  getSuppliers(): Observable<Supplier[]> { return this.http.get<Supplier[]>(this.base); }
  getSupplier(id: string): Observable<Supplier> { return this.http.get<Supplier>(`${this.base}/${id}`); }
  create(req: SupplierRequest): Observable<Supplier> { return this.http.post<Supplier>(this.base, req); }
  update(id: string, req: SupplierRequest): Observable<Supplier> { return this.http.put<Supplier>(`${this.base}/${id}`, req); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
}
