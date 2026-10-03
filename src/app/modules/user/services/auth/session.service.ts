// ═══════════════════════════════════════════════════════════
// SESSION SERVICE  (user self-service session management)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { SessionResponse } from '../../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  getMySessions(): Observable<SessionResponse[]> {
    return this.http.get<SessionResponse[]>(`${this.base}/auth/sessions/me`);
  }

  logoutOtherSession(sessionId: string): Observable<{ message: string }> {
    const params = new HttpParams().set('sessionId', sessionId);
    return this.http.post<{ message: string }>(`${this.base}/auth/logout-session`, null, { params });
  }

  forceLogoutAll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forcer-logout`, null);
  }
}
