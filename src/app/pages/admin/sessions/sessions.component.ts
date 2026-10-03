import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { AdminSessionService, AdminUserService } from '../../../services';

interface Session {
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  dateCreation: string;
  dateExpiration: string;
}

interface UserGroup {
  email: string;
  initials: string;
  sessions: Session[];
  expanded: boolean;
}

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [CommonModule, DatePipe, UpperCasePipe],
  templateUrl: './sessions.component.html'
})
export class SessionsComponent implements OnInit {
  private adminService = inject(AdminSessionService);
  private userService = inject(AdminUserService);

  private INTERNAL_ROLES = ['ADMINISTRATEUR', 'SUPPORT_TECHNIQUE', 'CHEF_DE_PROJET', 'APPRO', 'TECHNICIEN'];
  private internalEmails = new Set<string>();

  sessions: Session[] = [];
  allSessions: Session[] = [];
  userGroups: UserGroup[] = [];
  loading = true;
  error = '';
  terminatingId: string | null = null;
  terminatingEmail: string | null = null;

  // Confirm modal
  showConfirmModal = false;
  sessionToTerminate: Session | null = null;

  // Bulk confirm modal
  showBulkConfirmModal = false;
  userToBulkTerminate: UserGroup | null = null;

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.loading = true;
    this.error = '';
    // Load internal user emails first
    this.userService.getInternalUsers(0, 200).subscribe({
      next: (res: any) => {
        this.internalEmails = new Set(
          res.content.map((u: any) => u.email)
        );
        // Then load sessions
        this.adminService.getActiveSessions().subscribe({
          next: (data: any[]) => {
            this.allSessions = data;
            this.sessions = data.filter(s => this.internalEmails.has(s.email));
            this.buildUserGroups();
            this.loading = false;
          },
          error: () => {
            this.error = "Impossible de charger les sessions actives.";
            this.loading = false;
          }
        });
      },
      error: () => {
        this.error = "Impossible de charger les utilisateurs.";
        this.loading = false;
      }
    });
  }

  buildUserGroups() {
    const map = new Map<string, Session[]>();
    for (const s of this.sessions) {
      const list = map.get(s.email) || [];
      list.push(s);
      map.set(s.email, list);
    }
    this.userGroups = Array.from(map.entries()).map(([email, sessions]) => ({
      email,
      initials: email.substring(0, 2).toUpperCase(),
      sessions: sessions.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()),
      expanded: false
    }));
  }

  get totalSessions(): number {
    return this.sessions.length;
  }

  get uniqueUsers(): number {
    return this.userGroups.length;
  }

  get avgSessionsPerUser(): string {
    if (this.uniqueUsers === 0) return '0';
    return (this.totalSessions / this.uniqueUsers).toFixed(1);
  }

  toggleUser(group: UserGroup) {
    group.expanded = !group.expanded;
  }

  // ── Single session terminate ──
  confirmTerminate(session: Session) {
    this.sessionToTerminate = session;
    this.showConfirmModal = true;
  }

  cancelTerminate() {
    this.sessionToTerminate = null;
    this.showConfirmModal = false;
  }

  terminateSession() {
    if (!this.sessionToTerminate) return;
    const sessionId = this.sessionToTerminate.id;
    const email = this.sessionToTerminate.email;

    this.terminatingId = sessionId;
    this.showConfirmModal = false;
    this.adminService.logoutSession(sessionId).subscribe({
      next: () => {
        this.terminatingId = null;
        this.sessionToTerminate = null;
        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        this.buildUserGroups();
      },
      error: (err: any) => {
        this.terminatingId = null;
        this.sessionToTerminate = null;
        this.error = "Erreur lors de la fermeture de la session : " + (err.error?.message || 'Erreur inconnue');
      }
    });
  }

  // ── Bulk terminate all sessions for a user ──
  confirmBulkTerminate(group: UserGroup) {
    this.userToBulkTerminate = group;
    this.showBulkConfirmModal = true;
  }

  cancelBulkTerminate() {
    this.userToBulkTerminate = null;
    this.showBulkConfirmModal = false;
  }

  bulkTerminateUser() {
    if (!this.userToBulkTerminate) return;
    const email = this.userToBulkTerminate.email;
    const sessionIds = this.userToBulkTerminate.sessions.map(s => s.id);

    this.terminatingEmail = email;
    this.showBulkConfirmModal = false;

    // Terminate all sessions sequentially
    let completed = 0;
    for (const sid of sessionIds) {
      this.adminService.logoutSession(sid).subscribe({
        next: () => {
          completed++;
          this.sessions = this.sessions.filter(s => s.id !== sid);
          if (completed === sessionIds.length) {
            this.terminatingEmail = null;
            this.userToBulkTerminate = null;
            this.buildUserGroups();
          }
        },
        error: () => {
          completed++;
          if (completed === sessionIds.length) {
            this.terminatingEmail = null;
            this.userToBulkTerminate = null;
            this.buildUserGroups();
            this.error = "Certaines sessions n'ont pas pu être fermées.";
          }
        }
      });
    }
  }

  /** Parse user-agent to extract browser name */
  getBrowser(ua: string): string {
    if (!ua) return 'Inconnu';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Autre';
  }

  /** Parse user-agent to extract OS */
  getOS(ua: string): string {
    if (!ua) return '';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return '';
  }
}
