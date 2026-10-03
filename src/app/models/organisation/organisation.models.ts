// ══════════════════════════════════════════════════════════
// ORGANISATION DOMAIN MODELS  (mirrors Organisation entity)
// ══════════════════════════════════════════════════════════

export interface Organisation {
  id: string;
  raisonSociale: string;
  matriculeFiscale: string;
  logo: string | null;
  adresse?: string;
  userAssocie?: string;
  dateCreation?: string;
  nbCommandes?: number;
}

export interface OrganisationRequest {
  raisonSociale: string;
  matriculeFiscale: string;
}
