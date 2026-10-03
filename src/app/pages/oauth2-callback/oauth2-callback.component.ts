import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, ProfileService } from '../../services';

@Component({
  selector: 'app-oauth2-callback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './oauth2-callback.component.html'
})
export class Oauth2CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);

  loading = true;
  errorMessage = '';

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');

    if (error) {
      this.loading = false;
      this.errorMessage = this.mapError(error);
      return;
    }

    if (token && refreshToken) {
      // Store tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);

      // Store the deviceId sent by the backend (ensures both sides match)
      const deviceId = params.get('deviceId');
      if (deviceId) {
        localStorage.setItem('device_id', deviceId);
      } else if (!localStorage.getItem('device_id')) {
        // Fallback: generate one client-side if backend didn't send it
        localStorage.setItem('device_id', crypto.randomUUID());
      }

      // Fetch user profile
      this.profileService.getProfile().subscribe({
        next: (user) => {
          this.authService.updateStoredUser(user);
          // Start the proactive refresh timer for Google users too
          this.authService.startRefreshTimer();
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'Impossible de récupérer votre profil. Veuillez réessayer.';
        }
      });
    } else {
      this.loading = false;
      this.errorMessage = 'Paramètres de connexion manquants.';
    }
  }

  private mapError(error: string): string {
    switch (error) {
      case 'email_exists_local':
        return 'Cet email est déjà associé à un compte local. Veuillez vous connecter avec votre mot de passe.';
      case 'account_disabled':
        return 'Votre compte est désactivé. Veuillez contacter l\'administrateur.';
      default:
        return 'Une erreur s\'est produite lors de la connexion. Veuillez réessayer.';
    }
  }
}
