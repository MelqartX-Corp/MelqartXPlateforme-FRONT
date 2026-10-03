// ═══════════════════════════════════════════════
// SHARED MODELS  (reusable across all modules)
// ═══════════════════════════════════════════════

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

// Spring Boot Page format (used by ms-stock)
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;   // page courante (0-indexed)
  first: boolean;
  last: boolean;
}
