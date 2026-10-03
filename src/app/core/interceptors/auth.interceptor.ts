import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../modules/user/services/auth/auth.service';

const PUBLIC_URLS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/resend-otp',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh-token',
  '/api/v1/auth/setup-password',
  '/api/v1/auth/validate-setup-token',
  '/api/v1/invitations/validate',
  '/api/v1/invitations/accept',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip auth header for public endpoints
  if (PUBLIC_URLS.some(url => req.url.includes(url))) {
    return next(req);
  }

  const token = authService.getToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Contrôle horaire : le backend refuse l'accès hors heures de travail
      if (error.status === 403 && error.error?.error === 'OUTSIDE_WORK_HOURS') {
        authService.clearSession();
        showWorkHoursToast(error.error.message || 'Accès refusé : vous êtes en dehors des heures de travail (8h-19h).');
        return throwError(() => error);
      }
      if (error.status === 401 && !req.url.includes('/auth/refresh-token')) {
        return handle401(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function addToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
}

/**
 * Handle 401 — delegates to AuthService.refreshToken() which has a
 * built-in lock (isRefreshing + refresh$).  If a refresh is already
 * in-flight (either from the proactive timer or another 401), we
 * queue behind it instead of sending a duplicate request.
 */
function handle401(req: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService) {
  // AuthService.refreshToken() already handles the isRefreshing lock internally:
  // - If no refresh is in-flight → starts one
  // - If a refresh IS in-flight → queues behind it
  // So we just call it directly and replay the failed request with the new token.
  return authService.refreshToken().pipe(
    switchMap(res => next(addToken(req, res.token))),
    catchError(err => {
      // AuthService.refreshToken() already calls logout() on 400/401/403
      return throwError(() => err);
    })
  );
}

/** Premium toast modal for work-hours access denial */
function showWorkHoursToast(message: string): void {
  document.getElementById('work-hours-toast-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'work-hours-toast-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '99999',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem', animation: 'fadeIn .3s ease'
  });

  overlay.innerHTML = `
    <style>
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    </style>
    <div style="
      max-width:400px; width:100%; border-radius:1.25rem; overflow:hidden;
      background:#fff; box-shadow:0 25px 60px -12px rgba(0,0,0,.25);
      animation:slideUp .4s cubic-bezier(.16,1,.3,1);
      font-family:'Inter','Outfit',system-ui,sans-serif;
    ">
      <div style="height:4px;background:linear-gradient(90deg,#ef4444,#f97316)"></div>
      <div style="padding:2rem; text-align:center;">
        <div style="
          width:56px;height:56px;border-radius:1rem;margin:0 auto 1rem;
          display:flex;align-items:center;justify-content:center;
          background:rgba(239,68,68,.1);
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h3 style="margin:0 0 .5rem;font-size:1.125rem;font-weight:700;color:#111827;">Accès refusé</h3>
        <p style="margin:0 0 1.25rem;font-size:.8125rem;color:#6b7280;line-height:1.5;">${message}</p>
        <p style="margin:0;font-size:.6875rem;color:#9ca3af;">Redirection vers la connexion...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    window.location.href = '/login';
  }, 3500);
}
