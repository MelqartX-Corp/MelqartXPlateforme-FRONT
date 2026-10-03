import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services';

type Step = 'email' | 'otp' | 'success';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  step: Step = 'email';

  // Step 1
  email = '';
  emailError = '';
  emailSubmitting = false;

  // Step 2
  otp = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  resetError = '';
  resetSubmitting = false;

  // Countdown timer
  resendCountdown = 0;
  isResending = false;
  private resendTimer: any;

  onDigitOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) { event.preventDefault(); }
  }

  handleEmailSubmit(event: Event): void {
    event.preventDefault();
    this.emailError = '';
    if (!this.email || !this.email.includes('@')) {
      this.emailError = 'Veuillez saisir une adresse email valide.';
      return;
    }
    this.emailSubmitting = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.emailSubmitting = false;
        this.step = 'otp';
        this.startResendCountdown();
      },
      error: (err) => {
        this.emailSubmitting = false;
        this.emailError = err.error?.message || 'Une erreur est survenue. Vérifiez votre adresse email.';
      }
    });
  }

  handleResetSubmit(event: Event): void {
    event.preventDefault();
    this.resetError = '';
    if (this.otp.length < 6) { this.resetError = 'Code OTP invalide (6 chiffres requis).'; return; }
    if (this.newPassword.length < 8) { this.resetError = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    if (this.newPassword !== this.confirmPassword) { this.resetError = 'Les mots de passe ne correspondent pas.'; return; }
    this.resetSubmitting = true;
    this.authService.resetPassword({
      email: this.email,
      otp: this.otp,
      nouveauMotDePasse: this.newPassword
    }).subscribe({
      next: () => {
        this.resetSubmitting = false;
        this.step = 'success';
      },
      error: (err) => {
        this.resetSubmitting = false;
        this.resetError = err.error?.message || 'Code invalide ou expiré.';
      }
    });
  }

  resendCode(): void {
    if (this.resendCountdown > 0 || this.isResending) return;
    this.isResending = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isResending = false;
        this.startResendCountdown();
      },
      error: (err) => {
        this.isResending = false;
        this.resetError = err.error?.message || 'Impossible de renvoyer le code.';
      }
    });
  }

  startResendCountdown(): void {
    this.resendCountdown = 60;
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) clearInterval(this.resendTimer);
    }, 1000);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
