// ═══════════════════════════════════════════════════════════
// BLOCKED-USER SERVICE
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { BlockedUserResponse } from '../../models/auth.models';

@Injectable({ providedIn: 'root' })
export class BlockedUserService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  getBlockedUsers(): Observable<BlockedUserResponse[]> {
    return this.http.get<BlockedUserResponse[]>(`${this.base}/auth/blocked-users`);
  }

  isBlocked(email: string): Observable<{ blocked: boolean; details?: BlockedUserResponse }> {
    return this.http.get<{ blocked: boolean; details?: BlockedUserResponse }>(`${this.base}/auth/is-blocked/${email}`);
  }

  unblockUser(email: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/auth/unblock/${email}`, null);
  }
}
