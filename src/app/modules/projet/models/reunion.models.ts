export type StatutReunion = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE' | 'REPORTEE';

export interface PlageHoraire {
  heureDebut: string; // "HH:mm" ex: "09:00"
  heureFin: string;   // "HH:mm" ex: "12:00"
}

export interface JourDisponibilite {
  jour: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  actif: boolean;
  plages: PlageHoraire[];
}

export interface DisponibiliteChefProjet {
  id?: string;
  chefProjetId: string;
  fuseauHoraire: string;
  dureeCreneauMinutes: number;
  tempsTamponMinutes: number;
  jours: JourDisponibilite[];
  joursFeriesOuConges: string[];
  // Google Calendar / Meet OAuth2
  googleCalendarConnected?: boolean;
  googleEmail?: string;
  updatedAt?: string;
}

export interface CreneauDisponible {
  date: string; // "YYYY-MM-DD"
  debut: string; // ISO LocalDateTime
  fin: string;   // ISO LocalDateTime
  heureDebutFormattee: string; // "09:00"
  heureFinFormattee: string;   // "09:30"
  disponible: boolean;
}

export interface Reunion {
  id: string;
  projetId: string;
  projetNom: string;
  clientId: string;
  clientNom: string;
  clientEmail?: string;
  chefProjetId: string;
  chefProjetNom: string;
  chefProjetEmail?: string;
  dateDebut: string; // ISO LocalDateTime
  dateFin: string;   // ISO LocalDateTime
  titre: string;
  ordreDuJour?: string;
  tags?: string[];
  lienVisio: string; // Google Meet URL (https://meet.google.com/...)
  statut: StatutReunion;
  motifAnnulation?: string;
  annuleParId?: string;
  annuleParNom?: string;
  creeParId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReunionRequest {
  dateDebut: string; // ISO LocalDateTime "2026-09-03T14:30:00"
  titre: string;
  ordreDuJour?: string;
  tags?: string[];
}

export interface AnnulerReunionRequest {
  motif: string;
}

export interface DisponibiliteRequest {
  fuseauHoraire?: string;
  dureeCreneauMinutes?: number;
  tempsTamponMinutes?: number;
  jours?: JourDisponibilite[];
  joursFeriesOuConges?: string[];
}