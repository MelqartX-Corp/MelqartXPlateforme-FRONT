// ═══════════════════════════════════════════════
// AUTH DOMAIN MODELS  (mirrors /auth/* endpoints)
// ═══════════════════════════════════════════════

export interface LoginRequest {
  email: string;
  motDePasse: string;
  deviceId?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: import('../user/user.models').User;
  deviceId?: string;
}

export interface MfaLoginResponse {
  mfaRequired: boolean;
  message: string;
  suspicious?: boolean;       // OTP renforcé 8 chiffres (internes uniquement)
  overtimeRequired?: boolean; // Code d'accès overtime requis après OTP
  deviceId?: string;
}

export interface RegisterRequest {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  telephone: string;
  adresse: string;
  latitude?: number;
  longitude?: number;
  isEntreprise: boolean;
  organisation?: {
    raisonSociale: string;
    matriculeFiscale: string;
  };
}

export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  nouveauMotDePasse: string;
}

export interface BlockedUserResponse {
  email: string;
  blockedAt: string;
  reason?: string;
}
