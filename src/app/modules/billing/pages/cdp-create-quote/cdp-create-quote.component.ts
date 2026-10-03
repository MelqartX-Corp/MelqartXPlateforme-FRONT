import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { ServiceCatalog, CreateQuoteRequest } from '../../models/billing.models';
import { ProjetService } from '../../../projet/services/projet.service';

@Component({
  selector: 'app-cdp-create-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cdp-create-quote.component.html'
})
export class CdpCreateQuoteComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private projetSvc = inject(ProjetService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  projectId = '';
  projectName = '';
  userId = '';
  loading = true;
  submitting = false;
  successToast = '';
  errorMessage = '';

  services: ServiceCatalog[] = [];
  selectedService?: ServiceCatalog;

  req: CreateQuoteRequest = {
    projectId: '',
    projectName: '',
    userId: '',
    serviceId: '',
    quantity: 1,
    description: ''
  };

  subtotalHt = 0;
  taxAmount = 0;
  totalTtc = 0;
  tranche1 = 0;
  tranche2 = 0;

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    this.userId = this.route.snapshot.queryParamMap.get('userId') || '';
    const pName = this.route.snapshot.queryParamMap.get('projectName') || '';
    this.projectName = pName;
    this.req.projectName = pName;
    this.req.projectId = this.projectId;
    this.req.userId = this.userId;

    if (!this.projectName && this.projectId) {
      this.projetSvc.getProjet(this.projectId).subscribe({
        next: (p) => {
          if (p?.nom) {
            this.projectName = p.nom;
            this.req.projectName = p.nom;
          }
        }
      });
    }

    this.billingSvc.getServices().subscribe({
      next: (data) => {
        this.services = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onServiceChange() {
    this.selectedService = this.services.find(s => s.id === this.req.serviceId);
    this.recalculate();
  }

  recalculate() {
    if (!this.selectedService || !this.selectedService.currentPrice) return;
    const unitPrice = this.selectedService.currentPrice.unitPrice || 0;
    const taxRate = this.selectedService.currentPrice.taxRate || 19;
    const qty = this.req.quantity || 0;

    this.subtotalHt = qty * unitPrice;
    this.taxAmount = this.subtotalHt * (taxRate / 100);
    this.totalTtc = this.subtotalHt + this.taxAmount;
    this.tranche1 = this.totalTtc * 0.5;
    this.tranche2 = this.totalTtc - this.tranche1;
  }

  submitAndSendQuote() {
    this.submitting = true;
    this.billingSvc.createQuote(this.req).subscribe({
      next: (created) => {
        this.billingSvc.sendQuote(created.id).subscribe({
          next: () => {
            this.submitting = false;
            this.successToast = 'Devis ' + created.quoteNumber + ' créé et transmis au client avec succès !';
            setTimeout(() => this.router.navigate(['/validator/quotes']), 1500);
          },
          error: (err) => {
            this.submitting = false;
            this.errorMessage = 'Devis créé en brouillon, mais erreur lors de la transmission: ' + (err.error?.message || 'Erreur');
            setTimeout(() => this.router.navigate(['/validator/quotes']), 2000);
          }
        });
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Impossible de créer le devis';
      }
    });
  }

  cancel() {
    this.router.navigate(['/validator/quotes']);
  }
}
