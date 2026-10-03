import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services';

/**
 * Guard inversé : empêche les utilisateurs DÉJÀ connectés
 * d'accéder aux pages publiques (login, register, features...).
 * Redirige automatiquement vers /dashboard si une session existe.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
