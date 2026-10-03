// ═══════════════════════════════════════════════════════════
// SESSION SERVICE  (user self-service session management)
// Mirrors /auth/sessions/me, /auth/logout-session,
//         /auth/forcer-logout endpoints
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionResponse } from '../../models/shared/shared.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /** GET /auth/sessions/me — list my active sessions */
  getMySessions(): Observable<SessionResponse[]> {
    return this.http.get<SessionResponse[]>(`${this.base}/auth/sessions/me`);
  }

  /** POST /auth/logout-session?sessionId=... — close one of my sessions */
  logoutOtherSession(sessionId: string): Observable<{ message: string }> {
    const params = new HttpParams().set('sessionId', sessionId);
    return this.http.post<{ message: string }>(`${this.base}/auth/logout-session`, null, { params });
  }

  /** POST /auth/forcer-logout — disconnect all my other sessions */
  forceLogoutAll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forcer-logout`, null);
  }
}
