import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { CartService } from '../../services/cart.service';
import { Quote } from '../../models/billing.models';

@Component({
  selector: 'app-client-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-quotes.component.html'
})
export class ClientQuotesComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private cartService = inject(CartService);
  private router = inject(Router);

  loading = true;
  processingId = '';
  successToast = '';
  quotes: Quote[] = [];

  // Search & Filter & Sort state
  searchTerm = '';
  selectedStatus = 'ALL';
  sortBy = 'NEWEST';
  expandedQuoteId: string | null = null;
  copiedQuoteId: string | null = null;

  // Signature & Upload State
  selectedQuoteForSign: Quote | null = null;
  selectedFile: File | null = null;
  uploadingSigned = false;
  uploadError = '';
  isDragging = false;

  ngOnInit() {
    this.loadQuotes();
  }

  loadQuotes() {
    this.loading = true;
    this.billingSvc.getQuotes().subscribe({
      next: (data) => {
        this.quotes = data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // ─── KPI Computed Metrics ───
  get totalQuotesCount(): number {
    return this.quotes.length;
  }

  get pendingQuotesCount(): number {
    return this.quotes.filter(q => q.status === 'SENT').length;
  }

  get acceptedQuotesCount(): number {
    return this.quotes.filter(q => q.status === 'ACCEPTED').length;
  }

  get totalEngagedAmount(): number {
    return this.quotes
      .filter(q => q.status === 'ACCEPTED')
      .reduce((sum, q) => sum + (q.totalTtc || 0), 0);
  }

  // ─── Filtered and Sorted Quotes ───
  get filteredQuotes(): Quote[] {
    return this.quotes
      .filter(q => {
        // Status filter
        if (this.selectedStatus !== 'ALL' && q.status !== this.selectedStatus) {
          return false;
        }
        // Search term filter
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

  toggleExpandQuote(id: string) {
    this.expandedQuoteId = this.expandedQuoteId === id ? null : id;
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

  /**
   * Le devis lui-meme, en PDF.
   *
   * Distinct du contrat : celui-ci engage, celui-la chiffre. Un client qui
   * veut comparer notre prix a une offre concurrente n'a pas a faire signer
   * quoi que ce soit d'abord.
   */
  downloadQuote(q: Quote) {
    this.billingSvc.downloadQuotePdf(q.id).subscribe({
      next: (blob) => this.saveBlob(blob, 'Devis_' + q.quoteNumber + '.pdf'),
      error: () => alert('Erreur lors du telechargement du devis PDF')
    });
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  downloadContract(q: Quote) {
    this.billingSvc.downloadContractPdfByQuote(q.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Contrat_' + q.quoteNumber + '.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        alert('Erreur lors du téléchargement du contrat PDF');
      }
    });
  }

  openSignModal(q: Quote) {
    this.selectedQuoteForSign = q;
    this.selectedFile = null;
    this.uploadError = '';
    this.isDragging = false;
  }

  closeSignModal() {
    this.selectedQuoteForSign = null;
    this.selectedFile = null;
    this.uploadError = '';
    this.isDragging = false;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private handleFile(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.uploadError = 'Veuillez sélectionner un fichier au format PDF uniquement.';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.uploadError = 'La taille du fichier ne doit pas dépasser 15 Mo.';
      return;
    }
    this.selectedFile = file;
    this.uploadError = '';
  }

  submitSignedContract() {
    if (!this.selectedQuoteForSign || !this.selectedFile) return;
    const q = this.selectedQuoteForSign;
    this.uploadingSigned = true;
    this.uploadError = '';

    this.billingSvc.uploadSignedContractByQuote(q.id, this.selectedFile).subscribe({
      next: () => {
        this.uploadingSigned = false;
        this.selectedQuoteForSign = null;
        this.selectedFile = null;
        // Un devis instantane se regle en une fois, au panier : le client
        // vient d'y debloquer sa commande, on l'y ramene plutot que de le
        // laisser chercher. Le devis negocie, lui, attend sa facture
        // d'acompte — son parcours ne change pas.
        if (q.quoteOrigin === 'INSTANT') {
          this.successToast = 'Contrat signe et depose. Votre commande peut maintenant etre finalisee.';
          this.cartService.load().subscribe({
            next: () => this.router.navigate(['/client/panier']),
            error: () => this.loadQuotes()
          });
          return;
        }

        this.successToast = 'Contrat signé et déposé avec succès ! Votre facture d\'acompte (Tranche 1 - 50%) a été générée pour règlement.';
        this.loadQuotes();
      },
      error: (err) => {
        this.uploadingSigned = false;
        this.uploadError = err.error?.message || 'Erreur lors du téléversement du contrat signé.';
      }
    });
  }

  openRejectModal(q: Quote) {
    if (!confirm('Voulez-vous refuser ce devis ?')) return;
    this.processingId = q.id;
    this.billingSvc.rejectQuote(q.id).subscribe({
      next: () => {
        this.processingId = '';
        q.status = 'REJECTED';
      },
      error: () => {
        this.processingId = '';
      }
    });
  }
}
