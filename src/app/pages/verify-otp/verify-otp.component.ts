import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-otp.component.html'
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  otp = '';
  overtimeCode = '';
  error = '';
  submitting = false;
  isResending = false;
  resendCountdown = 0;
  private resendTimer: any;

  // Security flags
  isSuspicious = false;
  isOvertime = false;
  showOvertimeForm = false;

  get otpLength(): number { return this.isSuspicious ? 8 : 6; }
  get otpPattern(): string { return this.isSuspicious ? '[0-9]{8}' : '[0-9]{6}'; }

  ngOnInit() {
    this.email = localStorage.getItem('mfa_email') ?? '';
    if (!this.email) {
      this.router.navigate(['/login']);
      return;
    }
    this.isSuspicious = localStorage.getItem('mfa_suspicious') === 'true';
    this.isOvertime = localStorage.getItem('mfa_overtime') === 'true';
    this.startResendCountdown();
  }

  ngOnDestroy() {
    clearInterval(this.resendTimer);
  }

  handleVerify(event: Event) {
    event.preventDefault();
    this.error = '';
    if (this.otp.length < this.otpLength) {
      this.error = `Veuillez saisir le code à ${this.otpLength} chiffres.`;
      return;
    }

    // If overtime required, we need the overtime code AFTER OTP
    if (this.isOvertime) {
      this.showOvertimeForm = true;
      return;
    }

    this.submitting = true;
    const deviceId = localStorage.getItem('device_id') || '';
    this.authService.verifyOtp(this.email, this.otp, deviceId).subscribe({
      next: () => {
        this.submitting = false;
        this.cleanupFlags();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || 'Code invalide ou expiré.';
      }
    });
  }

  handleOvertimeSubmit(event: Event) {
    event.preventDefault();
    this.error = '';
    if (this.overtimeCode.length < 8) {
      this.error = 'Le code d\'accès doit contenir 8 caractères.';
      return;
    }
    this.submitting = true;
    const deviceId = localStorage.getItem('device_id') || '';
    this.authService.verifyOvertime(this.email, this.overtimeCode, this.otp, deviceId).subscribe({
      next: () => {
        this.submitting = false;
        this.cleanupFlags();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || 'Code d\'accès invalide ou expiré.';
      }
    });
  }

  resend() {
    if (this.resendCountdown > 0 || this.isResending) return;
    this.isResending = true;
    this.authService.resendOtp(this.email, 'LOGIN', this.isSuspicious).subscribe({
      next: () => {
        this.isResending = false;
        this.startResendCountdown();
      },
      error: (err) => {
        this.isResending = false;
        this.error = err.error?.message || 'Impossible de renvoyer le code.';
      }
    });
  }

  private startResendCountdown() {
    this.resendCountdown = 60;
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) clearInterval(this.resendTimer);
    }, 1000);
  }

  private cleanupFlags() {
    localStorage.removeItem('mfa_email');
    localStorage.removeItem('mfa_suspicious');
    localStorage.removeItem('mfa_overtime');
  }
}
