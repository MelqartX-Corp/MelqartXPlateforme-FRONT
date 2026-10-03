import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, interval } from 'rxjs';
import { BillingService } from '../../services/billing.service';
import { Invoice } from '../../models/billing.models';

import { ProfileService } from '../../../user/services/user/profile.service';

@Component({
  selector: 'app-cdp-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cdp-invoice-list.component.html'
})
export class CdpInvoiceListComponent implements OnInit, OnDestroy {
  private billingSvc = inject(BillingService);
  private profileSvc = inject(ProfileService);
  private sanitizer = inject(DomSanitizer);
  private pollSub?: Subscription;

  loading = true;
  invoices: Invoice[] = [];
  successMsg = '';
  copiedInvoiceId: string | null = null;
  downloadingId = '';
  previewingId = '';
  simulatingId = '';

  // Search & Filter
  searchTerm = '';
  selectedStatus = 'ALL';
  sortBy = 'NEWEST';

  // Preview Modal
  previewPdfUrl: SafeResourceUrl | null = null;
  previewInvoice: Invoice | null = null;

  ngOnInit() {
    this.loadInvoices();
    this.pollSub = interval(5000).subscribe(() => {
      if (!this.loading && !this.previewingId && !this.downloadingId && !this.simulatingId) {
        this.billingSvc.getInvoices().subscribe({
          next: (data) => {
            this.enrichInvoices(data || []);
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.pollSub) this.pollSub.unsubscribe();
  }

  loadInvoices() {
    this.loading = true;
    this.billingSvc.getInvoices().subscribe({
      next: (data) => {
        this.enrichInvoices(data || []);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private enrichInvoices(data: Invoice[]) {
    this.invoices = data || [];
    this.invoices.forEach(inv => {
      if (inv.userId && (!inv.customer || !inv.customer.name)) {
        this.profileSvc.getUserById(inv.userId).subscribe({
          next: (u) => {
            const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email || 'Client';
            inv.customer = {
              userId: u.id,
              name: fullName,
              email: u.email,
              companyName: (u as any).companyName || (u as any).nomSociete || ''
            };
          },
          error: () => {}
        });
      }
    });
  }

  // ─── Financial Narrative KPI Metrics ───
  get totalInvoicedTtc(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.totalTtc || 0), 0);
  }

  get totalInvoicedHt(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.subtotalHt || 0), 0);
  }

  get totalInvoicedTax(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.totalTax || 0), 0);
  }

  get totalPaid(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  }

  get totalBalanceDue(): number {
    return this.invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
  }

  get recoveryRate(): number {
    if (this.totalInvoicedTtc === 0) return 0;
    return (this.totalPaid / this.totalInvoicedTtc) * 100;
  }

  get paidInvoicesCount(): number {
    return this.invoices.filter(inv => inv.status === 'PAID').length;
  }

  get pendingInvoicesCount(): number {
    return this.invoices.filter(inv => inv.status === 'ISSUED').length;
  }

  get partialInvoicesCount(): number {
    return this.invoices.filter(inv => inv.status === 'ISSUED' && inv.amountPaid > 0).length;
  }

  // ─── Attention Layer Invoices (Requiring Project Management Action) ───
  get attentionInvoices(): Invoice[] {
    return this.invoices.filter(inv => inv.status === 'ISSUED');
  }

  isOverdue(inv: Invoice): boolean {
    if (inv.status !== 'ISSUED' || !inv.dueDate) return false;
    return new Date(inv.dueDate).getTime() < new Date().getTime();
  }

  getDueCountdown(dueDateStr?: string): string {
    if (!dueDateStr) return '30 jours';
    const due = new Date(dueDateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Échue depuis ${Math.abs(diffDays)}j`;
    if (diffDays === 0) return "Échéance aujourd'hui";
    return `Dans ${diffDays}j`;
  }

  getInvoicePaidPercent(inv: Invoice): number {
    if (!inv.totalTtc || inv.totalTtc === 0) return 0;
    return Math.min(100, Math.round(((inv.amountPaid || 0) / inv.totalTtc) * 100));
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
          const matchClient = inv.customer?.name?.toLowerCase().includes(term) || inv.customer?.companyName?.toLowerCase().includes(term);
          if (!matchNum && !matchContract && !matchProject && !matchClient) return false;
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

  viewInvoicePdf(invoice: Invoice) {
    this.previewingId = invoice.id;
    this.billingSvc.downloadInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
        this.previewingId = '';
        const rawUrl = window.URL.createObjectURL(blob);
        this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
        this.previewInvoice = invoice;
      },
      error: () => {
        this.previewingId = '';
        alert("Erreur lors de l'ouverture du PDF");
      }
    });
  }

  closePreview() {
    this.previewPdfUrl = null;
    this.previewInvoice = null;
  }

  simulatePayment(inv: Invoice) {
    if (!confirm(`Simuler la réception du règlement pour ${inv.invoiceNumber} ?\n\nCeci marquera l'encaissement et notifiera le pipeline projet via RabbitMQ.`)) return;
    this.simulatingId = inv.id;
    this.billingSvc.payInvoice(inv.id).subscribe({
      next: () => {
        this.simulatingId = '';
        this.loadInvoices();
        this.successMsg = `Règlement de ${inv.invoiceNumber} enregistré avec succès !`;
      },
      error: (err) => {
        this.simulatingId = '';
        alert("Erreur : " + (err.error?.message || "Échec de l'encaissement"));
      }
    });
  }
}
