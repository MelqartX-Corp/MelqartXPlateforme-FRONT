// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN DOMAIN MODELS  (mirrors /admin/* endpoints)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface NotificationResponse {
  id: string;
  type: string;
  title?: string;
  message: string;
  recipientUserId?: string;
  recipientRole?: string;
  linkUrl?: string;
  channel?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
  readAt?: string;
}

export interface DeviceResponse {
  deviceId?: string;
  ipAddress: string;
  deviceName: string;
  country: string | null;
  firstSeen: string;
  lastSeen: string;
  trusted: boolean;
}

export interface OvertimeRequest {
  dateDebut: string;
  dateFin: string;
  heureDebut: string;
  heureFin: string;
}

export interface OvertimeResponse {
  id: string;
  userId: string;
  userName: string;
  dateDebut: string;
  dateFin: string;
  heureDebut: string;
  heureFin: string;
  accessCode: string;
  used: boolean;
  createdAt: string;
}
/** Indicateurs utilisateurs du tableau de bord admin (GET /api/v1/admin/stats) */
export interface UserStats {
  total: number;
  actifs: number;
  bloques: number;
  nonVerifies: number;
  nouveauxCeMois: number;
  organisations: number;
  parRole: { cle: string; nombre: number }[];
  evolution: { mois: string; inscriptions: number }[];
}

// ═══════════════════════════════════════════════════════════════
// STATISTIQUES ADMINISTRATEUR — miroir de AdminStatsResponse
// ═══════════════════════════════════════════════════════════════

export interface KeyCount {
  key: string;
  count: number;
}

export interface MonthPoint {
  /** « 2026-03 » — clé stable, indépendante de la langue d'affichage. */
  month: string;
  label: string;
  count: number;
}

export interface DayPoint {
  day: string;
  label: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  blockedUsers: number;
  pendingSetup: number;
  verifiedUsers: number;
  unverifiedUsers: number;

  internalUsers: number;
  externalUsers: number;

  newUsersThisMonth: number;
  newUsersLastMonth: number;
  userGrowthPercent: number;

  totalOrganisations: number;
  organisationsWithUsers: number;

  activeSessions: number;
  onlineUsers: number;
  activeLast15Min: number;

  byRole: KeyCount[];
  byAuthProvider: KeyCount[];
  sessionsByDeviceType: KeyCount[];
  sessionsByBrowser: KeyCount[];
  sessionsByOs: KeyCount[];

  signupsByMonth: MonthPoint[];
  loginsByDay: DayPoint[];
}
