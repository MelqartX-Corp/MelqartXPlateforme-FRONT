// ═══════════════════════════════════════════════════════════
// AUTH SERVICE  (mirrors /auth/* Spring controller)
// Handles: login, register, OTP, logout, token refresh
//
// KEY DESIGN DECISIONS:
// - device_id persists in localStorage FOREVER (never cleared on logout)
//   so the backend recognises this browser as a trusted device.
// - A proactive refresh timer fires every 13 min (JWT lives 15 min)
//   to silently renew the access token BEFORE it expires.
// - isRefreshing + refresh$ are SHARED between the proactive timer and
//   the reactive interceptor so that only ONE refresh request is ever
//   in-flight at a time.  Without this, the two callers could send the
//   same refresh token simultaneously; the backend rotates it on the
//   first call, so the second call gets a 400 → premature logout.
// ═══════════════════════════════════════════════════════════

import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError, Subscription, interval, filter, take, switchMap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  LoginRequest, LoginResponse, MfaLoginResponse,
  RegisterRequest, ResetPasswordRequest
} from '../../models/auth.models';
import { User } from '../../models/user.models';
import { DeviceResponse } from '../../models/admin.models';

/** Proactive refresh interval: 13 minutes (JWT lives 15 min) */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private base   = `${environment.services.gateway}${environment.apiVersion}`;

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadStoredUser());
  currentUser$ = this.currentUserSubject.asObservable();

  /** Timer subscription for proactive token refresh */
  private refreshTimerSub: Subscription | null = null;

  /**
   * Shared refresh state — used by BOTH the proactive timer and the
   * reactive interceptor so only one HTTP call is ever in-flight.
   * The interceptor reads isRefreshing / refresh$ via getters.
   */
  private isRefreshing = false;
  private refresh$ = new BehaviorSubject<string | null>(null);

  constructor() {
    // Ensure a stable deviceId exists for this browser (persists forever)
    this.ensureDeviceId();
    // Start the proactive refresh timer if we have a session
    if (this.getRefreshToken()) {
      this.startRefreshTimer();
    }
  }

  ngOnDestroy(): void {
    this.stopRefreshTimer();
  }

  // ── Storage helpers ──────────────────────────────────────

  private loadStoredUser(): User | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Returns the persistent deviceId for this browser.
   * Creates one if it doesn't exist yet.
   */
  getDeviceId(): string {
    return this.ensureDeviceId();
  }

  private ensureDeviceId(): string {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('device_id', id);
    }
    return id;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get role() {
    return this.currentUserSubject.value?.role ?? null;
  }

  get userId(): string | null {
    return this.currentUserSubject.value?.id ?? null;
  }

  /**
   * L'utilisateur ne fait que regarder.
   *
   * L'ingenieur est un collaborateur invite par un client entreprise : il
   * travaille sur les projets de cette societe, mais rien ne lui appartient.
   * Il consulte les dossiers, il ne les cree pas, ne les modifie pas et ne
   * les achete pas — c'est le client qui engage sa societe, pas lui.
   */
  get lectureSeule(): boolean {
    return this.role === 'INGENIEUR';
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          return true;
        }
      } catch { }
    }

    return !!refreshToken;
  }

  storeSession(data: LoginResponse): void {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.deviceId) {
      localStorage.setItem('device_id', data.deviceId);
    }
    this.currentUserSubject.next(data.user);
    // (Re)start the proactive refresh timer whenever we get new tokens
    this.startRefreshTimer();
  }

  updateStoredUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    // NOTE: We intentionally do NOT remove 'device_id'.
    // The deviceId must persist across logouts so the backend
    // still recognises this browser as a trusted device.
    this.currentUserSubject.next(null);
    this.stopRefreshTimer();
  }

  // ── Auth endpoints ────────────────────────────────────────

  /** POST /auth/login */
  login(req: LoginRequest): Observable<LoginResponse | MfaLoginResponse> {
    return this.http.post<LoginResponse | MfaLoginResponse>(`${this.base}/auth/login`, req).pipe(
      tap(res => {
        if ('token' in res) {
          this.storeSession(res as LoginResponse);
        }
      })
    );
  }

  /** POST /auth/register */
  register(req: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.base}/auth/register`, req);
  }

  /** POST /auth/verify-email */
  verifyEmail(email: string, otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/verify-email`, { email, otp });
  }

  /** POST /auth/verify-otp (MFA step 2) */
  verifyOtp(email: string, otp: string, deviceId?: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/verify-otp`, { email, otp, deviceId }).pipe(
      tap(res => this.storeSession(res))
    );
  }

  /** POST /auth/resend-otp */
  resendOtp(email: string, type: 'EMAIL_VERIFICATION' | 'LOGIN' | 'RESET_PASSWORD', reinforced = false): Observable<{ message: string }> {
    let params = new HttpParams().set('email', email).set('type', type);
    if (reinforced) {
      params = params.set('reinforced', 'true');
    }
    return this.http.post<{ message: string }>(`${this.base}/auth/resend-otp`, null, { params });
  }

  /** POST /auth/forgot-password */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, { email });
  }

  /** POST /auth/reset-password */
  resetPassword(req: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, req);
  }

  // ── Password Setup / Onboarding (utilisateur interne) ──

  /** POST /auth/setup-password */
  setupPassword(token: string, motDePasse: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/setup-password`, { token, motDePasse });
  }

  /** GET /auth/validate-setup-token */
  validateSetupToken(token: string): Observable<{ valid: boolean; expired: boolean; message: string }> {
    const params = new HttpParams().set('token', token);
    return this.http.get<{ valid: boolean; expired: boolean; message: string }>(
      `${this.base}/auth/validate-setup-token`,
      { params }
    );
  }

  // ── Shared refresh lock (prevents proactive + reactive race) ─────

  /** True when a refresh HTTP call is already in-flight. */
  get refreshing(): boolean { return this.isRefreshing; }

  /** Emits the new access token once the in-flight refresh completes. */
  get refreshToken$(): BehaviorSubject<string | null> { return this.refresh$; }

  /**
   * POST /auth/refresh-token — used by BOTH the interceptor (reactive, on 401)
   * and the proactive timer.  Only ONE HTTP call is started at a time;
   * any concurrent caller waits on refresh$ instead of sending a 2nd request.
   */
  refreshToken(): Observable<LoginResponse> {
    // If a refresh is already in-flight, queue behind it
    if (this.isRefreshing) {
      return this.refresh$.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(() => {
          // Return the latest stored session as a synthetic LoginResponse
          const rt = this.getRefreshToken();
          const token = this.getToken();
          if (!token || !rt) return throwError(() => new Error('No session after refresh'));
          // Re-read user from storage so callers get a proper LoginResponse
          const user = this.currentUser;
          return new Observable<LoginResponse>(obs => {
            obs.next({ token, refreshToken: rt, userId: user?.id ?? '', email: user?.email ?? '', role: user?.role ?? '', user: user! } as LoginResponse);
            obs.complete();
          });
        })
      );
    }

    const rt = this.getRefreshToken();
    if (!rt) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    this.isRefreshing = true;
    this.refresh$.next(null);

    const params = new HttpParams().set('refreshToken', rt);
    return this.http.post<LoginResponse>(`${this.base}/auth/refresh-token`, null, { params }).pipe(
      tap(res => {
        this.storeSession(res);
        this.refresh$.next(res.token);  // unblock any queued callers
        this.isRefreshing = false;
      }),
      catchError(err => {
        this.isRefreshing = false;
        this.refresh$.next(null);
        // Logout uniquement si le token est vraiment invalide (pas erreur réseau)
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          this.logout();
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Refresh proactif (appelé par le timer toutes les 13 min).
   * Réutilise le même verrou isRefreshing que le refresh réactif →
   * si l'intercepteur est déjà en train de rafraîchir, on skip.
   */
  private proactiveRefresh(): void {
    // Skip si un refresh est déjà en cours (évite la race condition)
    if (this.isRefreshing) {
      console.log('[AUTH] Proactive refresh skipped — refresh already in progress');
      return;
    }

    const rt = this.getRefreshToken();
    if (!rt) { this.stopRefreshTimer(); return; }

    this.refreshToken().subscribe({
      next: () => console.log('[AUTH] Token proactively refreshed'),
      error: (err) => {
        // refreshToken() gère déjà le logout si 400/401/403
        if (err.status !== 400 && err.status !== 401 && err.status !== 403) {
          console.warn('[AUTH] Proactive refresh échoué (transitoire), prochaine tentative dans 13 min');
        }
      }
    });
  }

  /** POST /auth/logout */
  logout(): void {
    this.stopRefreshTimer();
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.base}/auth/logout`, null).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** POST /auth/verify-overtime */
  verifyOvertime(email: string, overtimeCode: string, otp: string, deviceId?: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/verify-overtime`, { email, overtimeCode, otp, deviceId }).pipe(
      tap(res => this.storeSession(res))
    );
  }

  /** GET /auth/devices/me */
  getMyDevices(): Observable<DeviceResponse[]> {
    return this.http.get<DeviceResponse[]>(`${this.base}/auth/devices/me`);
  }

  /** DELETE /auth/devices/{deviceId} */
  removeMyDevice(deviceId: string): Observable<{ message: string; selfRevoked: boolean }> {
    return this.http.delete<{ message: string; selfRevoked: boolean }>(`${this.base}/auth/devices/${encodeURIComponent(deviceId)}`);
  }

  validateSession(): void {
    if (!this.getToken()) return;
    this.http.get<User>(`${this.base}/users/me`).subscribe({
      next: user => this.updateStoredUser(user),
      error: (err) => {
        // Logout uniquement si le compte est vraiment invalidé côté backend (401/403)
        // Ne pas logout sur erreur réseau transitoire (Cloud Run cold start, timeout...)
        if (err.status === 401 || err.status === 403) {
          this.logout();
        }
      }
    });
  }

  // ── Proactive Token Refresh Timer ─────────────────────────

  /**
   * Starts a background timer that refreshes the access token
   * every 13 minutes (before the 15-minute JWT expiry).
   * This prevents the "session expired" problem entirely.
   * Public so the OAuth2 callback component can also start it.
   */
  startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimerSub = interval(REFRESH_INTERVAL_MS).subscribe(() => {
      if (this.getRefreshToken()) {
        this.proactiveRefresh(); // Utilise le refresh résilient (pas de logout sur erreur transitoire)
      } else {
        this.stopRefreshTimer();
      }
    });
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimerSub) {
      this.refreshTimerSub.unsubscribe();
      this.refreshTimerSub = null;
    }
  }
}
