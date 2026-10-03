import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = '';
  otp = '';
  error = '';
  submitting = false;
  verified = false;
  resendCountdown = 0;
  private resendTimer: any;

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    if (!this.email) {
      this.router.navigate(['/login']);
    }
    this.startResendCountdown();
  }

  handleVerify(event: Event) {
    event.preventDefault();
    this.error = '';
    if (this.otp.length < 6) {
      this.error = 'Veuillez saisir le code à 6 chiffres.';
      return;
    }
    this.submitting = true;
    this.authService.verifyEmail(this.email, this.otp).subscribe({
      next: () => {
        this.submitting = false;
        this.verified = true;
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || 'Code invalide ou expiré.';
      }
    });
  }

  resend() {
    if (this.resendCountdown > 0) return;
    this.authService.resendOtp(this.email, 'EMAIL_VERIFICATION').subscribe({
      next: () => this.startResendCountdown(),
      error: (err) => { this.error = err.error?.message || 'Impossible de renvoyer le code.'; }
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
}
