// ═══════════════════════════════════════════════
// USER DOMAIN MODELS  (mirrors /users/* endpoints)
// ═══════════════════════════════════════════════

export type UserRole =
  | 'CLIENT'
  | 'CLIENT_ENTREPRISE'
  | 'INGENIEUR'
  | 'ADMINISTRATEUR'
  | 'SUPPORT_TECHNIQUE'
  | 'CHEF_DE_PROJET'
  | 'APPRO'
  | 'TECHNICIEN';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  profileImage: string | null;
  organisationId: string | null;
  role: UserRole;
  dateCreation: string;
  actif: boolean;
  isVerified: boolean;
  authProvider: 'LOCAL' | 'GOOGLE';
  organisation: import('./organisation.models').Organisation | null;
  passwordSet?: boolean;
}

export interface UpdateProfileRequest {
  nom?: string;
  prenom?: string;
  telephone?: string;
  adresse?: string;
  organisation?: {
    raisonSociale: string;
    matriculeFiscale: string;
  };
}

export interface ChangePasswordRequest {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}

export interface CreateInternalUserRequest {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: string;
  role: 'SUPPORT_TECHNIQUE' | 'CHEF_DE_PROJET' | 'APPRO' | 'TECHNICIEN' | 'ADMINISTRATEUR';
}
