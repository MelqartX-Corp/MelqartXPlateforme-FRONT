import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InviteCollaboratorRequest,
  AcceptInvitationRequest,
  InvitationResponse,
  ValidateInvitationResponse
} from '../../models/invitation/invitation.models';
import { User } from '../../models/user/user.models';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private http = inject(HttpClient);
  private api = `${environment.services.gateway}${environment.apiVersion}/invitations`;

  /** Invite a collaborator (CLIENT_ENTREPRISE only) */
  invite(req: InviteCollaboratorRequest): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(this.api, req);
  }

  /** Validate a token (public — accept invitation page) */
  validate(token: string): Observable<ValidateInvitationResponse> {
    const params = new HttpParams().set('token', token);
    return this.http.get<ValidateInvitationResponse>(`${this.api}/validate`, { params });
  }

  /** Accept an invitation and create password (public) */
  accept(req: AcceptInvitationRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/accept`, req);
  }

  /** List invitations for my organisation */
  getMyOrgInvitations(): Observable<InvitationResponse[]> {
    return this.http.get<InvitationResponse[]>(`${this.api}/my-org`);
  }

  /** List members of my organisation */
  getMyOrgMembers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.api}/my-org/members`);
  }

  /** Cancel a pending invitation */
  cancel(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  /** Resend invitation email */
  resend(id: string): Observable<InvitationResponse> {
    return this.http.post<InvitationResponse>(`${this.api}/${id}/resend`, {});
  }

  /** Remove a member from the organisation (detach → CLIENT) */
  removeMember(memberId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/members/${memberId}`);
  }
}
