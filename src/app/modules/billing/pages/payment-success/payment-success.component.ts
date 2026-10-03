import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Fin de parcours du reglement.
 *
 * Plus rien a verifier a l'arrivee : le paiement est confirme par le serveur
 * avant la redirection, il n'y a pas de retour de passerelle a recouper.
 */
@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-success.component.html'
})
export class PaymentSuccessComponent {}
