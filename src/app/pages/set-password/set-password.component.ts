import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './set-password.component.html',
  styles: []
})
export class SetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  loading = true;
  tokenValid = false;
  tokenExpired = false;
  statusMessage = '';
  success = false;

  password = '';
  confirmPassword = '';
  showPwd = false;
  submitting = false;
  error = '';

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading = false;
      this.tokenValid = false;
      this.statusMessage = "Aucun jeton de configuration n'a été fourni dans le lien.";
      return;
    }

    this.authService.validateSetupToken(token).subscribe({
      next: (res) => {
        this.tokenValid = res.valid;
        this.tokenExpired = res.expired;
        this.statusMessage = res.message;
        this.loading = false;
      },
      error: (err) => {
        this.tokenValid = false;
        this.statusMessage = err.error?.message || "Erreur lors de la validation du jeton de configuration.";
        this.loading = false;
      }
    });
  }

  onSubmit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    this.error = '';
    this.submitting = true;

    this.authService.setupPassword(token, this.password).subscribe({
      next: () => {
        this.submitting = false;
        this.success = true;
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || "Erreur lors de l'enregistrement de votre mot de passe.";
      }
    });
  }
}
