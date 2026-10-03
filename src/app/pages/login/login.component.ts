import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, ThemeService } from '../../services';
import { LoginResponse, MfaLoginResponse } from '../../models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  theme = inject(ThemeService);

  email = '';
  password = '';
  error = '';
  info = '';
  submitting = false;
  showPassword = false;
  emailNotVerified = false;
  resendingVerification = false;
  googleAuthUrl = environment.googleAuthUrl;

  /**
   * Redirect to Google OAuth.
   * Write device_id to a cookie FIRST so the backend can reuse it
   * instead of generating a new UUID on every Google login.
   * (The backend cannot read localStorage — only cookies survive the redirect.)
   */
  onGoogleLogin(): void {
    const deviceId = this.authService.getDeviceId();
    // SameSite=None + Secure needed for cross-origin cookie (Google → our backend)
    document.cookie = `device_id=${deviceId}; path=/; max-age=300; SameSite=None; Secure`;
    window.location.href = this.googleAuthUrl;
  }

  handleLogin(event: Event) {
    event.preventDefault();
    this.error = '';
    this.info = '';
    this.submitting = true;

    const deviceId = this.authService.getDeviceId();

    this.authService.login({ email: this.email, motDePasse: this.password, deviceId }).subscribe({
      next: (res) => {
        this.submitting = false;
        if ('mfaRequired' in res && (res as MfaLoginResponse).mfaRequired) {
          const mfa = res as MfaLoginResponse;
          localStorage.setItem('mfa_email', this.email);

          // Always reset security flags first to clear stale state
          localStorage.removeItem('mfa_suspicious');
          localStorage.removeItem('mfa_overtime');

          // Then set only the flags that apply to THIS login
          if (mfa.suspicious) {
            localStorage.setItem('mfa_suspicious', 'true');
          }
          if (mfa.overtimeRequired) {
            localStorage.setItem('mfa_overtime', 'true');
          }
          // Sauvegarder le deviceId renvoyé par le backend (si généré côté serveur)
          if (mfa.deviceId) {
            localStorage.setItem('device_id', mfa.deviceId);
          }

          // Show backend message briefly before redirect
          this.info = mfa.message;
          setTimeout(() => this.router.navigate(['/verify-otp']), 1200);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.submitting = false;
        const msg = err.error?.message || 'Email ou mot de passe incorrect.';
        this.error = msg;
        // Detect "email not verified" error to show resend button
        this.emailNotVerified = msg.toLowerCase().includes('vérifier votre email');
      }
    });
  }

  resendVerification() {
    if (!this.email) return;
    this.resendingVerification = true;
    this.authService.resendOtp(this.email, 'EMAIL_VERIFICATION').subscribe({
      next: () => {
        this.resendingVerification = false;
        this.router.navigate(['/verify-email'], { queryParams: { email: this.email } });
      },
      error: (err) => {
        this.resendingVerification = false;
        this.error = err.error?.message || 'Impossible de renvoyer le code.';
      }
    });
  }
}
