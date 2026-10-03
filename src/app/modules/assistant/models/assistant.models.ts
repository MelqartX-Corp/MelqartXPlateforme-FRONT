// ════════════════════════════════════════════════════════════════
// ASSISTANT IA — modèles (miroir de ms-bom/assistant)
// ════════════════════════════════════════════════════════════════

export type AssistantRole = 'user' | 'assistant';

/** Action proposée par l'assistant, en attente de confirmation de l'utilisateur. */
export interface AssistantAction {
  id: 'upload_document' | 'create_project' | 'relaunch_dfm' | 'open_ticket';
  label: string;
  params: Record<string, string>;
  requiresFile: boolean;
  /** Gabarit de la question de confirmation, avec des jetons {param}. */
  confirm: string;
}

/** Résultat de l'analyse d'un fichier joint, produite par ms-bom. */
export interface FileAnalysis {
  kind: 'gerber' | 'bom' | 'pdf' | 'archive' | 'cao' | 'texte';
  fileName: string;
  summary: string;
  suggestedDocumentType?: string;
  dfmScore?: number;
  grade?: 'A' | 'B' | 'C' | 'D';
  violationCount?: number;
  bySeverity?: { HIGH: number; MEDIUM: number; LOW: number };
  uniqueComponents?: number;
  totalQuantity?: number;
  pageCount?: number;
  files?: string[];
}

export type ActionState = 'proposed' | 'running' | 'done' | 'failed' | 'cancelled';

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  createdAt?: string;
  /** Vrai tant que la réponse est en cours de génération (streaming). */
  pending?: boolean;
  /** Réponse bloquée par le filtrage de sortie côté serveur. */
  blocked?: boolean;
  action?: AssistantAction;
  actionState?: ActionState;
  actionDetail?: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  messages?: AssistantMessage[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeEntry {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  roles: string[];
  source?: 'curated' | 'generated';
  updatedBy?: string;
  updatedAt?: string;
}

/** Segment d'une réponse : texte brut ou lien interne cliquable. */
export interface AnswerSegment {
  kind: 'text' | 'link';
  text: string;
  path?: string;
}

/** Bloc de rendu d'une réponse assistant. */
export interface AnswerBlock {
  type: 'h' | 'li' | 'p';
  segments: AnswerSegment[];
}
