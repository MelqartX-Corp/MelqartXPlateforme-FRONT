import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PasswordService, AuthService } from '../../../services';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent implements OnInit {
  private passwordService = inject(PasswordService);
  private authService = inject(AuthService);
  private router = inject(Router);

  form = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saved = false;
  saving = false;
  error = '';
  isGoogleUser = false;

  ngOnInit() {
    const user = this.authService.currentUser;
    if (user?.authProvider === 'GOOGLE') {
      this.isGoogleUser = true;
    }
  }

  get strength(): number {
    const p = this.form.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)  s++;
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

  submit() {
    this.error = '';
    if (!this.form.currentPassword) { this.error = 'Veuillez saisir le mot de passe actuel.'; return; }
    if (this.form.newPassword.length < 8) { this.error = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'; return; }
    if (this.form.newPassword !== this.form.confirmPassword) { this.error = 'Les mots de passe ne correspondent pas.'; return; }

    this.saving = true;
    this.passwordService.changePassword({
      ancienMotDePasse: this.form.currentPassword,
      nouveauMotDePasse: this.form.newPassword
    }).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.form = { currentPassword: '', newPassword: '', confirmPassword: '' };
        setTimeout(() => this.saved = false, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || 'Erreur lors du changement de mot de passe.';
      }
    });
  }
}
