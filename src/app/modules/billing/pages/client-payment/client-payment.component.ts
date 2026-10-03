import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';

@Component({
  selector: 'app-client-payment',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-payment.component.html'
})
export class ClientPaymentComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  invoiceId = '';
  paying = false;

  ngOnInit() {
    this.invoiceId = this.route.snapshot.paramMap.get('invoiceId') || '';
  }

  erreur = '';

  /**
   * Encaisse la facture.
   *
   * Plus de redirection vers une passerelle externe : le montant est arrete
   * par le serveur sur la facture elle-meme, jamais annonce par le client.
   * C'est la meme voie pour tous les projets — serie instantanee comme etude
   * negociee.
   */
  pay() {
    this.paying = true;
    this.erreur = '';
    this.billingSvc.payInvoice(this.invoiceId).subscribe({
      next: () => this.router.navigate(['/payment/success']),
      error: (err: any) => {
        this.erreur = err.error?.message || "Le reglement n'a pas pu etre enregistre.";
        this.paying = false;
      }
    });
  }
}
