// ═══════════════════════════════════════════════
// INVITATION DOMAIN MODELS
// ═══════════════════════════════════════════════

export interface InviteCollaboratorRequest {
  email: string;
  nom: string;
  prenom: string;
}

export interface AcceptInvitationRequest {
  token: string;
  motDePasse: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface InvitationResponse {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  email: string;
  nom: string;
  prenom: string;
  organisationName: string;
  inviterName: string;
  message: string;
}
