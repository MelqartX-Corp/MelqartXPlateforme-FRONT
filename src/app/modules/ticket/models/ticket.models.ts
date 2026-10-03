// ════════════════════════════════════════════════════════════════
// TICKET DOMAIN MODELS (mirrors ms-ticket :8083 DTOs)
// ════════════════════════════════════════════════════════════════

export type TicketStatut = 'OUVERT' | 'EN_COURS' | 'RESOLU' | 'FERME';
export type TicketPriorite = 'BASSE' | 'MOYENNE' | 'HAUTE' | 'URGENTE';
/**
 * CONSULTATION : demande d'etude (Idee, Faisabilite, Validation).
 * RECLAMATION  : incident signale par un client.
 * CANAL_PROJET : conversation permanente d'un projet Prototype ou Production —
 *                elle ne se resout pas et ne se ferme pas.
 */
export type TicketType = 'CONSULTATION' | 'RECLAMATION' | 'CANAL_PROJET';

export interface Ticket {
  id: string;
  userId: string;
  projetId?: string;
  sujet: string;
  description: string;
  statut: TicketStatut;
  priorite: TicketPriorite;
  type: TicketType;
  resolvedAt?: string;
  firstResponseAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TicketRequest {
  sujet: string;
  description: string;
  projetId?: string;
  priorite?: TicketPriorite;
}

export interface Message {
  id: string;
  ticketId: string;
  senderId: string;
  senderNom: string;
  senderRole: string;
  content: string;
  createdAt?: string;
}

export interface MessageRequest {
  content: string;
}

export interface StatsResponse {
  totalTickets: number;
  resolvedTickets: number;
  resolutionRate: number; // en pourcentage
  averageResponseTimeMinutes: number;
}

// ═══════════════════════════════════════════════════════════════
// ANALYTIQUE SUPPORT — miroir de TicketAnalyticsResponse
// ═══════════════════════════════════════════════════════════════

export interface TicketKeyCount {
  key: string;
  count: number;
}

export interface TicketDayPoint {
  day: string;
  label: string;
  created: number;
  resolved: number;
}

export interface TicketHourPoint {
  hour: number;
  count: number;
}

export interface TicketAgentStat {
  id: string;
  name: string;
  resolved: number;
  avgResolutionHours: number;
}

export interface TicketAnalytics {
  total: number;
  ouverts: number;
  enCours: number;
  resolus: number;
  fermes: number;

  /** Ce qui reste à traiter : ouverts + en cours. */
  backlog: number;
  critiques: number;

  createdToday: number;
  resolvedToday: number;
  createdThisWeek: number;
  resolvedThisWeek: number;
  sansReponse: number;

  resolutionRate: number;
  avgFirstResponseMinutes: number;
  avgResolutionHours: number;
  slaBreaches: number;
  slaCompliance: number;
  /** null quand la file est vide — aucun ticket n'a d'âge. */
  oldestOpenHours: number | null;

  parStatut: TicketKeyCount[];
  parPriorite: TicketKeyCount[];
  parType: TicketKeyCount[];
  ageBuckets: TicketKeyCount[];

  evolution: TicketDayPoint[];
  chargeParHeure: TicketHourPoint[];
  topResolvers: TicketAgentStat[];
}

/**
 * La conversation d'un projet.
 *
 * Ni statut, ni priorite, ni resolution : ce n'est pas un dossier. Elle
 * s'adresse par le projet, pas par un identifiant de fil.
 */
export interface ProjectDiscussion {
  id: string;
  projetId: string;
  projetNom?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderNom?: string;
  /**
   * Ce qui reste a lire pour l'utilisateur courant, compte par le serveur sur
   * le fil lui-meme. C'est la source de la pastille de l'icone messagerie :
   * les notifications passent par une file d'evenements et peuvent manquer,
   * les messages non.
   */
  nonLus?: number;
  createdAt?: string;
}
