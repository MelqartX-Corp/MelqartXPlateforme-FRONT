// ═══════════════════════════════════════════════════════════
// COMPONENT SERVICE  (mirrors /api/components endpoints)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Component, ComponentRequest, MountType, ComponentCategory, ComponentSubCategory } from '../models/stock.models';
import { Page } from '../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class ComponentService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/components`;

  getComponents(page = 0, size = 20, sort = 'manufacturer,asc'): Observable<Page<Component>> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    return this.http.get<Page<Component>>(this.base, { params });
  }

  getComponent(id: string): Observable<Component> {
    return this.http.get<Component>(`${this.base}/${id}`);
  }

  getByMpn(mpn: string): Observable<Component> {
    return this.http.get<Component>(`${this.base}/mpn/${encodeURIComponent(mpn)}`);
  }

  search(filters: {
    manufacturer?: string;
    mpn?: string;
    packageType?: string;
    mountType?: MountType;
    category?: ComponentCategory;
    subCategory?: ComponentSubCategory;
    page?: number;
    size?: number;
  }): Observable<Page<Component>> {
    let params = new HttpParams().set('page', filters.page ?? 0).set('size', filters.size ?? 20);
    if (filters.manufacturer) params = params.set('manufacturer', filters.manufacturer);
    if (filters.mpn)          params = params.set('mpn', filters.mpn);
    if (filters.packageType)  params = params.set('packageType', filters.packageType);
    if (filters.mountType)    params = params.set('mountType', filters.mountType);
    if (filters.category)     params = params.set('category', filters.category);
    if (filters.subCategory)  params = params.set('subCategory', filters.subCategory);
    return this.http.get<Page<Component>>(`${this.base}/search`, { params });
  }

  create(req: ComponentRequest): Observable<Component> {
    return this.http.post<Component>(this.base, req);
  }

  update(id: string, req: ComponentRequest): Observable<Component> {
    return this.http.put<Component>(`${this.base}/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  uploadImage(id: string, file: File): Observable<Component> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<Component>(`${this.base}/${id}/image`, fd);
  }

  deleteImage(id: string): Observable<Component> {
    return this.http.delete<Component>(`${this.base}/${id}/image`);
  }
}
