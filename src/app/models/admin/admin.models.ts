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