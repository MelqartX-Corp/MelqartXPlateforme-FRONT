// ═══════════════════════════════════════════════════════════
// INVITATION SERVICE
// ═══════════════════════════════════════════════════════════

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  InviteCollaboratorRequest,
  AcceptInvitationRequest,
  InvitationResponse,
  ValidateInvitationResponse
} from '../../models/invitation.models';
import { User } from '../../models/user.models';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private http = inject(HttpClient);
  private api = `${environment.services.gateway}${environment.apiVersion}/invitations`;

  invite(req: InviteCollaboratorRequest): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(this.api, req);
  }

  validate(token: string): Observable<ValidateInvitationResponse> {
    const params = new HttpParams().set('token', token);
    return this.http.get<ValidateInvitationResponse>(`${this.api}/validate`, { params });
  }

  accept(req: AcceptInvitationRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/accept`, req);
  }

  getMyOrgInvitations(): Observable<InvitationResponse[]> {
    return this.http.get<InvitationResponse[]>(`${this.api}/my-org`);
  }

  getMyOrgMembers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.api}/my-org/members`);
  }

  cancel(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  resend(id: string): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(`${this.api}/${id}/resend`, {});
  }

  removeMember(memberId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/members/${memberId}`);
  }
}
