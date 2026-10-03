// ════════════════════════════════════════════════════════════════
// PROJET DOMAIN MODELS  (mirrors ms-projet :8082 DTOs)
// ════════════════════════════════════════════════════════════════

// ── Statuts ──────────────────────────────────────────────────────
export type ProjetStatut = 'BROUILLON' | 'PENDING' | 'QUOTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';

export type ProjectStage = 'EN_ATTENTE_CONTACT_SUPPORT' | 'EN_COURS_ANALYSE' | 'REDACTION_CAHIER_CHARGES' | 'FICHIERS_TECHNIQUES' | 'PRET_POUR_FLUX' | 'ABANDONNE'
  | 'FICHIERS_RECUS' | 'BOM_ANALYSEE' | 'EN_ATTENTE_CLIENT' | 'ALTERNATIVES_EN_ATTENTE' | 'BOM_VALIDEE'
  | 'PREPARATION_TESTS' | 'TESTS_EN_COURS' | 'RAPPORT_VALIDATION_DISPONIBLE' | 'VALIDATION_TERMINEE';


export type TypeDocumentProjet = 'BOM' | 'GERBER' | 'DOCUMENT_IDEE' | 'DOCUMENT_TECHNIQUE' | 'PLAN_TEST' | 'CAHIER_TEST' | 'RAPPORT_VALIDATION' | 'DOCUMENT_INTERNE' | 'CAHIER_DES_CHARGES' | 'PICK_AND_PLACE' | 'DRILL_FILE' | 'SOP' | 'DIAGRAMME' | 'AUTRE';


export type DfmAnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface DfmViolation {
  type: string;
  layer: string;
  measuredMm: number;
  minRequiredMm: number;
  xMm: number;
  yMm: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface DfmAnalysisResult {
  status: DfmAnalysisStatus;
  dfmScore?: number;
  grade?: 'A' | 'B' | 'C' | 'D';
  violations?: DfmViolation[];
  llmReport?: string;
  errorMessage?: string;
  analyzedAt?: string;
}

export interface DocumentProjet {
  id: string;
  projetId: string;
  nomDocument: string;
  fileUrl: string;
  typeDocument: TypeDocumentProjet;
  uploadedAt: string;
  uploadedBy?: string;
  dfmResult?: DfmAnalysisResult;
}

export type BomLifecycleState = 'ACTIVE' | 'VALIDATED' | 'ARCHIVED';
export type DecisionType = 'KEEP_ORIGINAL' | 'ACCEPT_ALTERNATIVE' | 'CLIENT_SUPPLY';

export interface BomComponentDecision {
  componentMpnOriginal: string;
  approvedMpn: string;
  decisionType: DecisionType;
  supplier?: string;
  comment?: string;
  validatedBy?: string;
  validatedAt?: string;
}

export interface AlternativesDecisionRequest {
  acceptAlternatives: boolean;
}

export interface BomComponentDecisionRequest {
  componentMpnOriginal: string;
  approvedMpn?: string;
  decisionType: DecisionType;
  supplier?: string;
  comment?: string;
}


// ── Cadrage Enums ────────────────────────────────────────────────
export type Industrie = 'IOT' | 'AUTOMOTIVE' | 'INDUSTRIAL' | 'SMART_INFRASTRUCTURE' | 'ENERGY' | 'LOGISTICS' | 'CONSUMER_ELECTRONICS' | 'MEDICAL_SPECIALIZED';
export type Objectif = 'IDEE' | 'FAISABILITE' | 'PROTOTYPE' | 'VALIDATION' | 'PRODUCTION';
export type HardwareNeed = 'ELECTRONIC_DESIGN' | 'PCB_DESIGN' | 'COMPONENT_SELECTION' | 'POWER_DESIGN' | 'REDESIGN' | 'REVERSE_ENGINEERING';
export type FirmwareNeed = 'FIRMWARE' | 'RTOS' | 'EMBEDDED_LINUX' | 'DRIVERS' | 'OTA' | 'DEBUGGING';
export type ManufacturingNeed = 'PCB_FAB' | 'SMT_ASSEMBLY' | 'PROTOTYPE_ASSEMBLY' | 'LOW_VOLUME_PRODUCTION' | 'SOURCING';
export type EngagementModel = 'ADVISORY' | 'ASSISTED_ENGINEERING' | 'TURNKEY' | 'MANUFACTURING_ONLY' | 'LONG_TERM_PARTNERSHIP';
export type Timeline = 'URGENT' | 'ONE_TO_THREE_MONTHS' | 'THREE_TO_SIX_MONTHS' | 'SIX_PLUS_MONTHS';

// ── Cadrage ──────────────────────────────────────────────────────
export interface Cadrage {
  industrie?: Industrie;
  objectif?: Objectif;
  hardwareNeeds?: HardwareNeed[];
  firmwareNeeds?: FirmwareNeed[];
  manufacturingNeeds?: ManufacturingNeed[];
  engagementModel?: EngagementModel;
  timeline?: Timeline;
  quantiteSouhaitee?: number;
}

export interface CadrageRequest {
  industrie?: Industrie;
  objectif?: Objectif;
  hardwareNeeds?: HardwareNeed[];
  firmwareNeeds?: FirmwareNeed[];
  manufacturingNeeds?: ManufacturingNeed[];
  engagementModel?: EngagementModel;
  timeline?: Timeline;
  quantiteSouhaitee?: number;
}

export interface BomComponent {
  mpn: string;
  quantity: number;
  manufacturer?: string;
  marque?: string;
}

// ── Projet ───────────────────────────────────────────────────────
export interface ProjectAssignmentResponse {
  id: string;
  projetId: string;
  userId: string;
  userNom: string;
  role: string;
  assignedById: string;
  assignedByNom: string;
  createdAt: string;
}

export interface Projet {
  id: string;
  nom: string;
  description?: string;
  userId: string;

  /**
   * Le client, nomme — resolu par le serveur a chaque lecture.
   *
   * La liste ne portait que son identifiant : chercher « les projets de
   * Ben Raslene » demandait d'ouvrir les fiches une par une.
   */
  clientNom?: string;
  clientEmail?: string;
  assignments: ProjectAssignmentResponse[];
  statut: ProjetStatut;
  stage?: ProjectStage;
  documents?: DocumentProjet[];
  fichiersTechniques?: string[];
  fichiersInternes?: string[];
  cadrage?: Cadrage;
  bomUploaded: boolean;

  bomRequired: boolean;
  historiquePhases?: PhaseArchive[];

  /**
   * Une demande d'annulation attend une reponse.
   *
   * Le client y lit « votre demande est a l'etude » plutot qu'un ecran
   * inchange qui donnerait l'impression que son clic s'est perdu ; le chef
   * de projet y lit qu'on attend sa decision.
   */
  annulationDemandee?: boolean;
  annulationRaison?: string;
  annulationDemandeeLe?: string;
  /** Renseigne quand l'equipe a refuse : le client doit pouvoir lire pourquoi. */
  annulationRefusMotif?: string;

  createdAt?: string;
  updatedAt?: string;
}

// ── Phase Archive (historique de transition) ──────────────────
export interface PhaseArchive {
  objectif: Objectif;
  cadrage: Cadrage;
  stage?: ProjectStage;
  statut: ProjetStatut;
  dateValidation: string;
}

// ── Transition Request ───────────────────────────────────────
export interface TransitionRequest {
  bomFileId?: string;
  quantiteSouhaitee?: number;
}


// ── BOM Response (collection séparée) ────────────────────────────
export interface BomResponse {
  id: string;
  projetId: string;
  filename: string;
  uploadedAt: string;
  totalComponents: number;
  components: BomComponent[];
  lifecycleState?: BomLifecycleState;
  decisions?: BomComponentDecision[];
}

export interface StockCheckComponent {
  mpn: string;
  requiredQuantity: number;
  availableQuantity: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'MISSING' | 'AVAILABLE_WITH_DELAY' | 'PARTIAL_WITH_DELAY';
  manufacturer?: string;
  requestedManufacturer?: string;
  onOrderQuantity?: number;
  estimatedDelivery?: string;
}

export interface ProjectStockStatusResponse {
  status: 'FULLY_AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'INSUFFICIENT' | 'UNKNOWN';
  message?: string;
  checkedAt?: string;
  details: StockCheckComponent[];
}

export interface ProjetRequest {
  nom: string;
  description?: string;
}

export interface ProjetUpdateRequest {
  nom?: string;
  description?: string;
  statut?: ProjetStatut;
}

export interface ProjectAssignRequest {
  userId: string;
  nom: string;
  role: string;
}

export interface AssignmentHistoryResponse {
  id: string;
  projetId: string;
  staffId: string;
  staffNom: string;
  role: string;
  action: string;
  performedById: string;
  performedByNom: string;
  createdAt: string;
}

export interface UserWorkload {
  userId: string;
  projectCount: number;
}

// ── Alternatives ─────────────────────────────────────────────
export type AlternativeProvider = 'MOUSER' | 'DIGIKEY' | 'ALL';

export interface Alternative {
  mpn: string;
  manufacturer: string;
  description: string;
  lifecycleStatus: string;
  datasheetUrl?: string;
  source: string;
  status?: 'AVAILABLE' | 'PARTIAL' | 'MISSING' | 'AVAILABLE_WITH_DELAY' | 'PARTIAL_WITH_DELAY';
}

export interface AlternativeResponse {
  mpnOriginal: string;
  alternatives: Alternative[];
}

// ── Feedback qualité — expérience projet globale ────────────────
export interface ProjetFeedbackRequest {
  noteSupport: number;       // 1-5
  noteCommunication: number; // 1-5
  noteProduit: number;       // 1-5
  commentaire?: string;
}

export interface ProjetFeedback {
  id: string;
  projetId: string;
  projetNom: string;
  userId: string;
  noteSupport: number;
  noteCommunication: number;
  noteProduit: number;
  moyenne: number;
  commentaire?: string;
  supportId?: string;
  supportNom?: string;
  chefDeProjetId?: string;
  chefDeProjetNom?: string;
  createdAt: string;
}

/** Statistiques agregees calculees par le backend sur TOUTE la collection d'avis */
export interface FeedbackStats {
  total: number;
  moyenneGlobale: number;
  tauxSatisfaction: number;      // pourcentage entier d'avis >= 4/5
  avisCritiques: number;         // nombre d'avis <= 2/5
  moyenneSupport: number;
  moyenneCommunication: number;
  moyenneProduit: number;
  distribution: { note: number; nombre: number }[];
  parAgentSupport: FeedbackAgentStat[];
  parChefDeProjet: FeedbackAgentStat[];
}

export interface FeedbackAgentStat {
  agentId: string;
  nom?: string;
  moyenne: number;
  nombre: number;
}

export interface PendingFeedback {
  projetId: string;
  projetNom: string;
}



/**
 * Indicateurs projets (GET /api/v1/projets/stats).
 *
 * Même forme pour tout le monde ; seul le périmètre change. L'administrateur
 * les reçoit sur toute la base, le chef de projet et le support sur leurs
 * seules affectations — un unique composant d'affichage suffit des deux côtés.
 */
export interface ProjetStats {
  total: number;
  enCours: number;
  livres: number;
  annules: number;
  brouillons: number;
  nouveauxCeMois: number;
  nouveauxMoisPrecedent: number;

  /** Projets sans affectation interne — la file d'attente d'entrée. */
  nonAssignes: number;
  enAttenteContact: number;
  enAttenteClient: number;

  /** null tant qu'aucun projet n'est livré : 0 se lirait « livré le jour même ». */
  delaiMoyenLivraisonJours: number | null;
  ageMoyenOuvertsJours: number | null;

  parStatut: RepartitionProjet[];
  parStage: RepartitionProjet[];
  parIndustrie: RepartitionProjet[];
  parObjectif: RepartitionProjet[];
  parTimeline: RepartitionProjet[];

  evolution: EvolutionProjet[];

  reunionsPlanifiees: number;
  reunionsCetteSemaine: number;
  reunionsTerminees: number;
  reunionsAujourdhui: number;

  noteMoyenne: number | null;
  avisRecus: number;

  /** Charge par membre — rempli pour l'administrateur seulement. */
  charge: ChargeMembre[];
}

export interface RepartitionProjet {
  cle: string;
  nombre: number;
}

export interface EvolutionProjet {
  /** « 2026-03 » — clé stable ; `label` est le libellé français court. */
  mois: string;
  label: string;
  crees: number;
  livres: number;
}

export interface ChargeMembre {
  userId: string;
  nom: string;
  role: string;
  projets: number;
  actifs: number;
}
