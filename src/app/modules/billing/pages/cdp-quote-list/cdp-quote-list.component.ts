import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { Quote } from '../../models/billing.models';

@Component({
  selector: 'app-cdp-quote-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cdp-quote-list.component.html'
})
export class CdpQuoteListComponent implements OnInit, OnDestroy {
  private pollSub?: Subscription;
  private billingSvc = inject(BillingService);
  private sanitizer = inject(DomSanitizer);

  previewPdfUrl: SafeResourceUrl | null = null;
  previewQuote: Quote | null = null;
  previewingId = '';

  loading = true;
  error = '';
  sendingId = '';
  downloadingSignedId = '';
  successToast = '';
  quotes: Quote[] = [];

  // Search, Filter & Sort
  searchTerm = '';
  selectedStatus = 'ALL';
  sortBy = 'NEWEST';
  copiedQuoteId: string | null = null;

  ngOnInit() {
    this.loadQuotes();
    this.pollSub = interval(4000).subscribe(() => {
      this.billingSvc.getQuotes().subscribe({
        next: (data) => {
          if (!this.loading && !this.sendingId && !this.previewingId && !this.downloadingSignedId) {
            this.quotes = data || [];
          }
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }

  loadQuotes() {
    this.loading = true;
    this.billingSvc.getQuotes().subscribe({
      next: (data) => {
        this.quotes = data || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des devis';
        this.loading = false;
      }
    });
  }

  // ─── Executive Narrative Financial Helpers ───
  get pendingQuotesCount(): number {
    return this.quotes.filter(q => q.status === 'SENT').length;
  }

  get acceptedQuotesCount(): number {
    return this.quotes.filter(q => q.status === 'ACCEPTED').length;
  }

  get totalVolumeTtc(): number {
    return this.quotes.reduce((sum, q) => sum + (q.totalTtc || 0), 0);
  }

  get totalVolumeHt(): number {
    return this.quotes.reduce((sum, q) => sum + (q.subtotalHt || 0), 0);
  }

  get totalVolumeTax(): number {
    return this.quotes.reduce((sum, q) => sum + (q.totalTax || 0), 0);
  }

  get acceptedVolumeTtc(): number {
    return this.quotes
      .filter(q => q.status === 'ACCEPTED')
      .reduce((sum, q) => sum + (q.totalTtc || 0), 0);
  }

  get conversionRate(): number {
    if (this.quotes.length === 0) return 0;
    return (this.acceptedQuotesCount / this.quotes.length) * 100;
  }

  get acceptedPercentage(): number {
    if (this.quotes.length === 0) return 0;
    return (this.acceptedQuotesCount / this.quotes.length) * 100;
  }

  get pendingPercentage(): number {
    if (this.quotes.length === 0) return 0;
    return (this.pendingQuotesCount / this.quotes.length) * 100;
  }

  get draftPercentage(): number {
    if (this.quotes.length === 0) return 0;
    return (this.countStatus('DRAFT') / this.quotes.length) * 100;
  }

  countStatus(status: string): number {
    return this.quotes.filter(q => q.status === status).length;
  }

  // ─── Filtered and Sorted Quotes ───
  get filteredQuotes(): Quote[] {
    return this.quotes
      .filter(q => {
        if (this.selectedStatus !== 'ALL' && q.status !== this.selectedStatus) {
          return false;
        }
        if (this.searchTerm.trim()) {
          const term = this.searchTerm.toLowerCase().trim();
          const matchNum = q.quoteNumber?.toLowerCase().includes(term);
          const matchProject = q.projectName?.toLowerCase().includes(term) || q.projectId?.toLowerCase().includes(term);
          if (!matchNum && !matchProject) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (this.sortBy === 'NEWEST') {
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        }
        if (this.sortBy === 'OLDEST') {
          return new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
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
      this.copiedQuoteId = id;
      setTimeout(() => {
        if (this.copiedQuoteId === id) this.copiedQuoteId = null;
      }, 2000);
    }
  }

  sendQuote(q: Quote) {
    this.sendingId = q.id;
    this.billingSvc.sendQuote(q.id).subscribe({
      next: (updated) => {
        this.sendingId = '';
        q.status = updated.status;
        this.successToast = `Devis ${q.quoteNumber} transmis au client avec succès ! Le projet passe au statut QUOTED.`;
      },
      error: (err) => {
        this.sendingId = '';
        this.error = err.error?.message || 'Impossible de transmettre le devis';
      }
    });
  }

  downloadSignedContract(q: Quote) {
    this.downloadingSignedId = q.id;
    this.billingSvc.downloadSignedContractByQuote(q.id).subscribe({
      next: (blob) => {
        this.downloadingSignedId = '';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contrat_signe_${q.quoteNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.downloadingSignedId = '';
        alert("Erreur lors du téléchargement du contrat signé : " + (err.error?.message || "Fichier introuvable"));
      }
    });
  }

  viewSignedContract(q: Quote) {
    this.previewingId = q.id;
    this.billingSvc.downloadSignedContractByQuote(q.id).subscribe({
      next: (blob) => {
        this.previewingId = '';
        const rawUrl = window.URL.createObjectURL(blob);
        this.previewPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
        this.previewQuote = q;
      },
      error: (err) => {
        this.previewingId = '';
        alert("Erreur lors de l'ouverture du contrat : " + (err.error?.message || "Erreur"));
      }
    });
  }

  closePreview() {
    this.previewPdfUrl = null;
    this.previewQuote = null;
  }
}
