// ═══════════════════════════════════════════════════════════
// PASSWORD SERVICE  (mirrors PUT /users/me/password)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChangePasswordRequest } from '../../models/user/user.models';

@Injectable({ providedIn: 'root' })
export class PasswordService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /** PUT /users/me/password */
  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/users/me/password`, data);
  }
}
