import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Politique de confidentialité — page publique, sans connexion.
 * Google exige ce lien, sur le domaine de l'application, pour publier
 * l'écran de consentement OAuth (connexion Google et Google Agenda).
 */
@Component({
  selector: 'app-confidentialite',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confidentialite.component.html'
})
export class ConfidentialiteComponent {
  readonly contact = 'rimabenabdallah472@gmail.com';
  readonly miseAJour = '15 septembre 2026';
}
