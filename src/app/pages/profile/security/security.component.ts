import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PasswordService, SessionService, AuthService } from '../../../services';
import { DeviceResponse } from '../../../models';

interface MySession {
  id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  deviceName?: string;   // "Chrome · Windows"
  browser?: string;      // "Chrome"
  os?: string;           // "Windows"
  deviceType?: string;   // "PC", "MOBILE", "UNKNOWN"
  dateCreation: string;
  dateExpiration: string;
  lastActivity?: string;
  isCurrentSession?: boolean;
}

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './security.component.html'
})
export class SecurityComponent implements OnInit {
  private authService = inject(AuthService);
  private passwordService = inject(PasswordService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  // ── Password form ──
  form = { currentPassword: '', newPassword: '', confirmPassword: '' };
  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saved = false;
  saving = false;
  passwordError = '';
  isGoogleUser = false;

  // ── Sessions ──
  sessions: MySession[] = [];  
  loadingSessions = true;           
  sessionsError = '';
  terminatingId: string | null = null;
  forcingLogout = false;
  currentToken = '';

  // Confirm modals
  showTerminateModal = false;
  sessionToTerminate: MySession | null = null;
  showForceLogoutModal = false;

  // ── Trusted Devices ──
  devices: DeviceResponse[] = [];
  loadingDevices = true;
  devicesError = '';
  removingIp: string | null = null;
  showRemoveDeviceModal = false;
  deviceToRemove: DeviceResponse | null = null;

  ngOnInit() {
    const user = this.authService.currentUser;
    if (user?.authProvider === 'GOOGLE') {
      this.isGoogleUser = true;
    }
    this.currentToken = this.authService.getToken() || '';
    this.loadSessions();
    this.loadDevices();
  }

  isExternalUser(): boolean {
    const r = this.authService.role;
    return r === 'CLIENT' || r === 'CLIENT_ENTREPRISE' || r === 'INGENIEUR';
  }

  // ─────────────────────────────────────────
  // PASSWORD
  // ─────────────────────────────────────────

  get strength(): number {
    const p = this.form.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  }

  get strengthLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort', 'Très fort'][this.strength];
  }

  get strengthColor(): string {
    return ['', 'text-destructive', 'text-warning', 'text-success', 'text-success'][this.strength];
  }

  submitPassword() {
    this.passwordError = '';
    if (!this.form.currentPassword) { this.passwordError = 'Veuillez saisir le mot de passe actuel.'; return; }
    if (this.form.newPassword.length < 8) { this.passwordError = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'; return; }
    if (this.form.newPassword !== this.form.confirmPassword) { this.passwordError = 'Les mots de passe ne correspondent pas.'; return; }

    this.saving = true;
    this.passwordService.changePassword({
      ancienMotDePasse: this.form.currentPassword,
      nouveauMotDePasse: this.form.newPassword
    }).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.form = { currentPassword: '', newPassword: '', confirmPassword: '' };
        setTimeout(() => this.saved = false, 4000);
      },
      error: (err) => {
        this.saving = false;
        this.passwordError = err.error?.message || 'Erreur lors du changement de mot de passe.';
      }
    });
  }

  // ─────────────────────────────────────────
  // SESSIONS
  // ─────────────────────────────────────────

  loadSessions() {
    this.loadingSessions = true;
    this.sessionsError = '';
    this.sessionService.getMySessions().subscribe({
      next: (data: any[]) => {
        this.sessions = data.sort((a, b) =>
          new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
        );
        this.loadingSessions = false;
      },
      error: () => {
        this.sessionsError = "Impossible de charger vos sessions.";
        this.loadingSessions = false;
      }
    });
  }

  get otherSessions(): MySession[] {
    return this.sessions.filter(s => !this.isCurrentSession(s));
  }

  get currentSession(): MySession | null {
    return this.sessions.find(s => this.isCurrentSession(s)) || null;
  }

  isCurrentSession(s: MySession): boolean {
    return !!s.isCurrentSession;
  }

  // ── Single session terminate ──
  confirmTerminate(session: MySession) {
    this.sessionToTerminate = session;
    this.showTerminateModal = true;
  }

  cancelTerminate() {
    this.sessionToTerminate = null;
    this.showTerminateModal = false;
  }

  terminateSession() {
    if (!this.sessionToTerminate) return;
    const sid = this.sessionToTerminate.id;
    this.terminatingId = sid;
    this.showTerminateModal = false;

    this.sessionService.logoutOtherSession(sid).subscribe({
      next: () => {
        this.terminatingId = null;
        this.sessionToTerminate = null;
        this.sessions = this.sessions.filter(s => s.id !== sid);
      },
      error: (err) => {
        this.terminatingId = null;
        this.sessionToTerminate = null;
        this.sessionsError = err.error?.message || 'Erreur lors de la fermeture.';
      }
    });
  }

  // ── Force logout all others ──
  openForceLogout() {
    this.showForceLogoutModal = true;
  }

  cancelForceLogout() {
    this.showForceLogoutModal = false;
  }

  forceLogoutAll() {
    this.forcingLogout = true;
    this.showForceLogoutModal = false;

    this.sessionService.forceLogoutAll().subscribe({
      next: () => {
        this.forcingLogout = false;
        // Keep only current session
        if (this.currentSession) {
          this.sessions = [this.currentSession];
        } else {
          this.loadSessions();
        }
      },
      error: (err) => {
        this.forcingLogout = false;
        this.sessionsError = err.error?.message || 'Erreur lors de la déconnexion.';
      }
    });
  }

  // ─────────────────────────────────────────
  // TRUSTED DEVICES
  // ─────────────────────────────────────────

  loadDevices() {
    this.loadingDevices = true;
    this.devicesError = '';
    this.authService.getMyDevices().subscribe({
      next: (data) => {
        this.devices = data;
        this.loadingDevices = false;
      },
      error: () => {
        this.devicesError = 'Impossible de charger vos appareils.';
        this.loadingDevices = false;
      }
    });
  }

  confirmRemoveDevice(device: DeviceResponse) {
    this.deviceToRemove = device;
    this.showRemoveDeviceModal = true;
  }

  cancelRemoveDevice() {
    this.deviceToRemove = null;
    this.showRemoveDeviceModal = false;
  }

  removeDevice() {
    if (!this.deviceToRemove) return;
    const did = this.deviceToRemove.deviceId || this.deviceToRemove.ipAddress;
    this.removingIp = did;
    this.showRemoveDeviceModal = false;

    this.authService.removeMyDevice(did).subscribe({
      next: (res: any) => {
        this.removingIp = null;
        this.deviceToRemove = null;
        this.devices = this.devices.filter(d => (d.deviceId || d.ipAddress) !== did);

        // Si l'utilisateur a retiré SON PROPRE appareil courant → déconnexion immédiate
        if (res.selfRevoked) {
          // Petite pause pour que l'utilisateur voie le résultat
          setTimeout(() => this.authService.logout(), 1500);
        }
      },
      error: (err) => {
        this.removingIp = null;
        this.deviceToRemove = null;
        this.devicesError = err.error?.message || 'Erreur lors du retrait.';
      }
    });
  }

  getBrowser(session: MySession): string {
    const browser = session.browser || this._parseBrowser(session.userAgent);
    const os = session.os || this._parseOS(session.userAgent);
    const type = session.deviceType;
    if (type === 'PC') return `PC ${os}`;
    if (type === 'MOBILE') return `Mobile ${os}`;
    // Fallback : déduire du userAgent
    const ua = session.userAgent || '';
    if (ua.includes('Android') || ua.includes('iPhone')) return `Mobile ${os}`;
    return `PC ${os}`;
  }

  getOS(session: MySession): string {
    return session.browser || this._parseBrowser(session.userAgent);
  }

  private _parseBrowser(ua?: string): string {
    if (!ua) return 'Navigateur';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Autre';
  }

  private _parseOS(ua?: string): string {
    if (!ua) return '';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return '';
  }

  getDeviceIcon(session: MySession | string): 'desktop' | 'mobile' | 'tablet' {
    if (typeof session === 'object' && session.deviceType) {
      return session.deviceType === 'MOBILE' ? 'mobile' : 'desktop';
    }
    const ua = typeof session === 'string' ? session : (session?.userAgent || '');
    if (ua.includes('iPhone') || (ua.includes('Android') && ua.includes('Mobile'))) return 'mobile';
    if (ua.includes('iPad') || ua.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  getTimeAgo(date: string): string {
    if (!date) return '';
    let dateStr = date;
    if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
      dateStr += 'Z';
    }
    
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  getCountryFlag(country: string | null): string {
    if (!country || country.length !== 2) return '🌍';
    const codePoints = country.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
}
