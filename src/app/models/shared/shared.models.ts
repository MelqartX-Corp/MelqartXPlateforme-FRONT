// ═══════════════════════════════════════════
// SHARED MODELS  (reusable across domains)
// ═══════════════════════════════════════════

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface SessionResponse {
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  dateCreation: string;
  dateExpiration: string;
}

export interface ApiMessage {
  message: string;
}
