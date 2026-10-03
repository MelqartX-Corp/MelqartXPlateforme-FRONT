// ═══════════════════════════════════════════════════════════
// PROFILE SERVICE  (mirrors GET/PUT /users/me)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { User, UpdateProfileRequest } from '../../models/user.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.base}/users/me`);
  }

  updateProfile(data: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.base}/users/me`, data);
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.base}/users/${id}`);
  }
}
