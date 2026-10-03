// ═══════════════════════════════════════════════════════════
// ADMIN ORG SERVICE  (mirrors GET /admin/organisations)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Organisation } from '../../models/organisation.models';

@Injectable({ providedIn: 'root' })
export class AdminOrgService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  getOrganisations(): Observable<Organisation[]> {
    return this.http.get<Organisation[]>(`${this.base}/admin/organisations`);
  }
}
