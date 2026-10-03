// ═══════════════════════════════════════════════════════════
// ADMIN STATS SERVICE  (miroir de GET /admin/stats)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AdminStats } from '../../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /**
   * Indicateurs comptes, organisations et sessions.
   *
   * Les totaux viennent du serveur et non d'un comptage de pages : additionner
   * les éléments d'une liste paginée donnerait le total d'une page.
   */
  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/admin/stats`);
  }
}
