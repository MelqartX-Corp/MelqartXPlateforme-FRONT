// ═══════════════════════════════════════════════════════════
// ADMIN SESSION SERVICE  (mirrors /admin/users/sessions and
//   /admin/sessions/{sessionId}/logout endpoints)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionResponse } from '../../models/shared/shared.models';

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /** GET /admin/users/sessions?userId= (optional filter) */
  getActiveSessions(userId?: string): Observable<SessionResponse[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    return this.http.get<SessionResponse[]>(`${this.base}/admin/users/sessions`, { params });
  }

  /** POST /admin/sessions/{sessionId}/logout */
  logoutSession(sessionId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/sessions/${sessionId}/logout`, null);
  }
}
