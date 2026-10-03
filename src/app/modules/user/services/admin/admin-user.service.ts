// ═══════════════════════════════════════════════════════════
// ADMIN USER SERVICE  (mirrors /admin/users/* endpoints)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { User, CreateInternalUserRequest, UpdateProfileRequest } from '../../models/user.models';
import { DeviceResponse, OvertimeRequest, OvertimeResponse, UserStats } from '../../models/admin.models';
import { PaginatedResponse } from '../../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /** GET /admin/stats — indicateurs utilisateurs du tableau de bord (ADMINISTRATEUR) */
  getUserStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.base}/admin/stats`);
  }

  /** GET /admin/users/internal?page=&size=&actif= */
  getInternalUsers(page = 0, size = 10, emailOrActive?: string | boolean): Observable<PaginatedResponse<User>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (typeof emailOrActive === 'boolean') params = params.set('actif', emailOrActive);
    if (typeof emailOrActive === 'string' && emailOrActive) params = params.set('email', emailOrActive);
    return this.http.get<PaginatedResponse<User>>(`${this.base}/admin/users/internal`, { params });
  }

  /** GET /admin/users/external?page=&size=&actif= */
  getExternalUsers(page = 0, size = 10, emailOrActive?: string | boolean): Observable<PaginatedResponse<User>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (typeof emailOrActive === 'boolean') params = params.set('actif', emailOrActive);
    if (typeof emailOrActive === 'string' && emailOrActive) params = params.set('email', emailOrActive);
    return this.http.get<PaginatedResponse<User>>(`${this.base}/admin/users/external`, { params });
  }

  /** GET /admin/users/{id} */
  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.base}/admin/users/${id}`);
  }

  /** GET /admin/users/{id} — alias used by existing pages */
  getUserById(id: string): Observable<User> {
    return this.getUser(id);
  }

  /** GET /admin/users/search?email= — returns single User */
  searchByEmail(email: string): Observable<User> {
    const params = new HttpParams().set('email', email);
    return this.http.get<User>(`${this.base}/admin/users/search`, { params });
  }

  /** GET /admin/users/by-role?role= */
  getUsersByRole(role: string): Observable<User[]> {
    const params = new HttpParams().set('role', role);
    return this.http.get<User[]>(`${this.base}/admin/users/by-role`, { params });
  }

  /** POST /admin/users */
  createUser(req: CreateInternalUserRequest): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/users`, req);
  }

  /** POST /admin/users — alias used by existing pages */
  createInternalUser(req: CreateInternalUserRequest): Observable<User> {
    return this.createUser(req);
  }

  /** PUT /admin/users/{id} */
  updateUser(id: string, req: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.base}/admin/users/${id}`, req);
  }

  /** DELETE /admin/users/{id} (soft delete — backend: @DeleteMapping) */
  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/users/${id}`);
  }

  /** PUT /admin/users/{id}/reactivate (backend: @PutMapping) */
  reactivateUser(id: string): Observable<User> {
    return this.http.put<User>(`${this.base}/admin/users/${id}/reactivate`, null);
  }

  /** POST /admin/users/{id}/resend-setup-link */
  resendSetupLink(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${userId}/resend-setup-link`, null);
  }

  /** GET /admin/users/{id}/devices */
  getUserDevices(id: string): Observable<DeviceResponse[]> {
    return this.http.get<DeviceResponse[]>(`${this.base}/admin/users/${id}/devices`);
  }

  /** DELETE /admin/users/{id}/devices/{deviceIdOrIp} */
  revokeDevice(userId: string, deviceIdOrIp: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/admin/users/${userId}/devices/${encodeURIComponent(deviceIdOrIp)}`
    );
  }

  /** POST /admin/users/{id}/force-logout */
  forceLogout(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${id}/force-logout`, null);
  }

  /** POST /admin/users/{id}/force-logout — alias used by existing pages */
  forceLogoutUser(id: string): Observable<{ message: string }> {
    return this.forceLogout(id);
  }

  /** GET /admin/users/{id}/is-blocked */
  isBlocked(id: string): Observable<{ blocked: boolean; details?: any }> {
    return this.http.get<{ blocked: boolean; details?: any }>(`${this.base}/admin/users/${id}/is-blocked`);
  }

  /** POST /admin/users/{id}/unblock */
  unblockUser(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${id}/unblock`, null);
  }

  /** POST /admin/users/{id}/overtime */
  grantOvertime(id: string, req: OvertimeRequest): Observable<OvertimeResponse> {
    return this.http.post<OvertimeResponse>(`${this.base}/admin/users/${id}/overtime`, req);
  }

  /** GET /admin/users/{id}/overtime */
  getOvertimeHistory(id: string): Observable<OvertimeResponse[]> {
    return this.http.get<OvertimeResponse[]>(`${this.base}/admin/users/${id}/overtime`);
  }

  /** GET /admin/overtime/active — tous les overtimes valides aujourd'hui (1 requête) */
  getActiveOvertimes(): Observable<OvertimeResponse[]> {
    return this.http.get<OvertimeResponse[]>(`${this.base}/admin/overtime/active`);
  }
}
