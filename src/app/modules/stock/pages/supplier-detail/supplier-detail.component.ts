import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { Supplier, SupplierRequest } from '../../models/stock.models';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './supplier-detail.component.html',
})
export class SupplierDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(SupplierService);

  loading = true; error = '';
  supplier?: Supplier;

  // Edit modal
  showEditModal = false;
  saving = false; saveError = '';
  editForm: SupplierRequest = { name: '' };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadSupplier(id);
  }

  loadSupplier(id: string) {
    this.loading = true;
    this.svc.getSupplier(id).subscribe({
      next: (s) => { this.supplier = s; this.loading = false; },
      error: () => { this.error = 'Fournisseur introuvable'; this.loading = false; }
    });
  }

  countryFlag(code: string): string {
    const flags: Record<string, string> = {
      'CN': '🇨🇳', 'DE': '🇩🇪', 'US': '🇺🇸', 'TN': '🇹🇳', 'JP': '🇯🇵', 'KR': '🇰🇷',
      'TW': '🇹🇼', 'FR': '🇫🇷', 'GB': '🇬🇧', 'IT': '🇮🇹', 'NL': '🇳🇱', 'CH': '🇨🇭',
      'IN': '🇮🇳', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'SG': '🇸🇬'
    };
    return flags[code?.toUpperCase()] || '🌍';
  }


  openEdit() {
    if (!this.supplier) return;
    this.saveError = '';
    this.editForm = {
      name: this.supplier.name,
      source: this.supplier.source
    };
    this.showEditModal = true;
  }

  closeEdit() { this.showEditModal = false; }

  saveEdit() {
    if (!this.supplier) return;
    this.saving = true; this.saveError = '';
    this.svc.update(this.supplier.id, this.editForm).subscribe({
      next: (updated) => {
        this.supplier = updated;
        this.saving = false;
        this.showEditModal = false;
      },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }
}
