// ═══════════════════════════════════════════════════════════
// LOGO SERVICE  (mirrors POST/DELETE /users/me/organisation/logo)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LogoService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  upload(file: File): Observable<{ message: string; url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ message: string; url: string }>(`${this.base}/users/me/organisation/logo`, fd);
  }

  delete(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/users/me/organisation/logo`);
  }
}
