// ═══════════════════════════════════════════════════════════
// ADMIN USER SERVICE  (mirrors /admin/users/* endpoints)
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UpdateProfileRequest, CreateInternalUserRequest } from '../../models/user/user.models';
import { PaginatedResponse } from '../../models/shared/shared.models';
import { DeviceResponse, OvertimeRequest, OvertimeResponse } from '../../models/admin/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}`;

  /** GET /admin/users/internal?actif=true&page=&size= */
  getInternalUsers(page = 0, size = 10, actif = true): Observable<PaginatedResponse<User>> {
    const params = new HttpParams().set('page', page).set('size', size).set('actif', actif);
    return this.http.get<PaginatedResponse<User>>(`${this.base}/admin/users/internal`, { params });
  }

  /** GET /admin/users/external?actif=true&page=&size= */
  getExternalUsers(page = 0, size = 10, actif = true): Observable<PaginatedResponse<User>> {
    const params = new HttpParams().set('page', page).set('size', size).set('actif', actif);
    return this.http.get<PaginatedResponse<User>>(`${this.base}/admin/users/external`, { params });
  }

  /** GET /admin/users/{id} */
  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.base}/admin/users/${id}`);
  }

  /** GET /admin/users/search?email= */
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
  createInternalUser(data: CreateInternalUserRequest): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/users`, data);
  }

  /** PUT /admin/users/{id} */
  updateUser(id: string, data: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.base}/admin/users/${id}`, data);
  }

  /** DELETE /admin/users/{id} (soft delete) */
  deactivateUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/users/${id}`);
  }

  /** PUT /admin/users/{id}/reactivate */
  reactivateUser(id: string): Observable<User> {
    return this.http.put<User>(`${this.base}/admin/users/${id}/reactivate`, null);
  }

  /** POST /admin/users/{id}/resend-setup-link */
  resendSetupLink(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${userId}/resend-setup-link`, null);
  }

  /** POST /admin/users/{userId}/forcer-logout */
  forceLogoutUser(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${userId}/forcer-logout`, null);
  }

  // ── Devices ──────────────────────────────────────────────

  /** GET /admin/users/{userId}/devices */
  getUserDevices(userId: string): Observable<DeviceResponse[]> {
    return this.http.get<DeviceResponse[]>(`${this.base}/admin/users/${userId}/devices`);
  }

  /** DELETE /admin/users/{userId}/devices/{deviceId} */
  revokeDevice(userId: string, deviceId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/admin/users/${userId}/devices/${encodeURIComponent(deviceId)}`);
  }

  // ── Overtime ─────────────────────────────────────────────

  /** POST /admin/users/{userId}/overtime */
  grantOvertime(userId: string, req: OvertimeRequest): Observable<OvertimeResponse> {
    return this.http.post<OvertimeResponse>(`${this.base}/admin/users/${userId}/overtime`, req);
  }

  /** GET /admin/users/{userId}/overtime */
  getOvertimeHistory(userId: string): Observable<OvertimeResponse[]> {
    return this.http.get<OvertimeResponse[]>(`${this.base}/admin/users/${userId}/overtime`);
  }
}
