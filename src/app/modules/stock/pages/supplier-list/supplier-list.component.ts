import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupplierService } from '../../services/supplier.service';
import { Supplier, SupplierRequest } from '../../models/stock.models';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-list.component.html',
})
export class SupplierListComponent implements OnInit {
  private svc = inject(SupplierService);
  private router = inject(Router);
  loading = true; error = '';
  suppliers: Supplier[] = [];
  showModal = false; isEditing = false; saving = false; saveError = ''; editId = '';
  form: SupplierRequest = { name: '' };
  showDeleteModal = false; deletingId = ''; deleting = false;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getSuppliers().subscribe({
      next: (data) => { this.suppliers = data; this.loading = false; },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  openCreate() { this.isEditing = false; this.editId = ''; this.saveError = ''; this.form = { name: '', source: '' }; this.showModal = true; }
  openEdit(s: Supplier) { this.isEditing = true; this.editId = s.id; this.saveError = ''; this.form = { name: s.name, source: s.source }; this.showModal = true; }
  closeModal() { this.showModal = false; }

  save() {
    this.saving = true; this.saveError = '';
    const obs = this.isEditing ? this.svc.update(this.editId, this.form) : this.svc.create(this.form);
    obs.subscribe({
      next: () => { this.saving = false; this.showModal = false; this.load(); },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(id: string) { this.deletingId = id; this.showDeleteModal = true; }
  cancelDelete() { this.showDeleteModal = false; }
  doDelete() {
    this.deleting = true;
    this.svc.delete(this.deletingId).subscribe({
      next: () => { this.deleting = false; this.showDeleteModal = false; this.load(); },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }

  viewDetails(id: string) { this.router.navigate(['/stock/suppliers', id]); }

  countryFlag(code: string): string {
    const flags: Record<string, string> = {
      'CN': '🇨🇳', 'DE': '🇩🇪', 'US': '🇺🇸', 'TN': '🇹🇳', 'JP': '🇯🇵', 'KR': '🇰🇷',
      'TW': '🇹🇼', 'FR': '🇫🇷', 'GB': '🇬🇧', 'IT': '🇮🇹', 'NL': '🇳🇱', 'CH': '🇨🇭',
      'IN': '🇮🇳', 'MY': '🇲🇾', 'TH': '🇹🇭', 'PH': '🇵🇭', 'SG': '🇸🇬'
    };
    return flags[code?.toUpperCase()] || '🌍';
  }

}
