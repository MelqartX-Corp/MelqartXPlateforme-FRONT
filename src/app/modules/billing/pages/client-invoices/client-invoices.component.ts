import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { AuthService } from '../../../../services';
import { Invoice } from '../../models/billing.models';

@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-invoices.component.html'
})
export class ClientInvoicesComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private router = inject(Router);
  authSvc = inject(AuthService);

  get isClient(): boolean {
    const r = this.authSvc.role;
    return r === 'CLIENT' || r === 'CLIENT_ENTREPRISE' || (!r?.includes('ADMIN') && !r?.includes('CHEF_DE_PROJET'));
  }

  loading = true;
  downloadingId = '';
  payingId = '';
  simulatingId = '';
  successMsg = '';
  invoices: Invoice[] = [];

  // Search & Filter state
  searchTerm = '';
  selectedStatus = 'ALL';
  sortBy = 'NEWEST';
  copiedInvoiceId: string | null = null;

  ngOnInit() {
    if (!this.isClient) {
      this.router.navigate(['/validator/invoices']);
      return;
    }
    this.loadInvoices();
  }

  loadInvoices() {
    this.loading = true;
    this.billingSvc.getInvoices().subscribe({
      next: (data) => {
        this.invoices = data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // ─── KPI Computed Metrics ───
  get totalInvoicedTtc(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.totalTtc || 0), 0);
  }

  get totalPaid(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  }

  get totalBalanceDue(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
  }

  get paidInvoicesCount(): number {
    return this.invoices.filter(inv => inv.status === 'PAID').length;
  }

  get pendingInvoicesCount(): number {
    return this.invoices.filter(inv => inv.status === 'ISSUED').length;
  }

  // ─── Filtered and Sorted Invoices ───
  get filteredInvoices(): Invoice[] {
    return this.invoices
      .filter(inv => {
        if (this.selectedStatus !== 'ALL' && inv.status !== this.selectedStatus) {
          return false;
        }
        if (this.searchTerm.trim()) {
          const term = this.searchTerm.toLowerCase().trim();
          const matchNum = inv.invoiceNumber?.toLowerCase().includes(term);
          const matchContract = inv.contractNumber?.toLowerCase().includes(term);
          const matchProject = inv.projectName?.toLowerCase().includes(term) || inv.projectId?.toLowerCase().includes(term);
          if (!matchNum && !matchContract && !matchProject) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (this.sortBy === 'NEWEST') {
          return new Date(b.issuedAt || '').getTime() - new Date(a.issuedAt || '').getTime();
        }
        if (this.sortBy === 'OLDEST') {
          return new Date(a.issuedAt || '').getTime() - new Date(b.issuedAt || '').getTime();
        }
        if (this.sortBy === 'AMOUNT_DESC') {
          return (b.totalTtc || 0) - (a.totalTtc || 0);
        }
        if (this.sortBy === 'AMOUNT_ASC') {
          return (a.totalTtc || 0) - (b.totalTtc || 0);
        }
        return 0;
      });
  }

  copyToClipboard(text: string, id: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedInvoiceId = id;
      setTimeout(() => {
        if (this.copiedInvoiceId === id) this.copiedInvoiceId = null;
      }, 2000);
    }
  }

  downloadPdf(invoice: Invoice) {
    this.downloadingId = invoice.id;
    this.billingSvc.downloadInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
        this.downloadingId = '';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingId = '';
        alert('Erreur lors du téléchargement de la facture PDF');
      }
    });
  }

  /**
   * Une commande se regle en une fois : ni acompte, ni solde, ni jalon de
   * signature. L'ecran annoncait « A regler (Tranche 1 - 50 %) » sur une
   * facture de commande a 200 000 dinars, juste a cote du badge « Facture
   * globale (100 %) » — deux affirmations contraires sur la meme ligne.
   */
  estReglementUnique(inv: Invoice): boolean {
    return inv.type === 'FULL';
  }

  /** Ou en est le reglement, dit avec les mots du parcours emprunte. */
  statutReglement(inv: Invoice): string {
    if (inv.status === 'PAID') return 'Payee a 100% ✅';
    if (this.estReglementUnique(inv)) return 'A regler — montant total ⏳';
    return inv.amountPaid > 0
      ? 'Acompte Paye (50%) ⏳ - Solde en attente'
      : 'A regler (Tranche 1 - 50%) ⏳';
  }

  progressionReglement(inv: Invoice): string {
    if (inv.status === 'PAID') return '100% (Integralement Soldee)';
    if (this.estReglementUnique(inv)) return '0% (En attente du reglement)';
    return inv.amountPaid > 0
      ? '50% (Acompte Regle)'
      : '0% (En attente du 1er reglement)';
  }

  /**
   * Regle la facture.
   *
   * Le bouton « Simuler » a disparu avec la passerelle : il n'y a plus deux
   * chemins a distinguer, un seul encaisse.
   */
  payOnline(inv: Invoice) {
    this.payingId = inv.id;
    this.billingSvc.payInvoice(inv.id).subscribe({
      next: () => {
        this.payingId = '';
        this.loadInvoices();
        this.successMsg = 'Reglement enregistre. La facture est soldee.';
      },
      error: (err) => {
        this.payingId = '';
        alert('Erreur: ' + (err.error?.message || "Le reglement n'a pas pu etre enregistre."));
      }
    });
  }
}
