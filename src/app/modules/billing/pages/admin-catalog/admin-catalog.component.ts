import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { ServiceCatalog, CreateServiceRequest, UpdatePriceRequest } from '../../models/billing.models';

@Component({
  selector: 'app-admin-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-catalog.component.html'
})
export class AdminCatalogComponent implements OnInit {
  private billingSvc = inject(BillingService);

  loading = true;
  error = '';
  services: ServiceCatalog[] = [];
  searchTerm = '';
  selectedCategory = 'ALL';
  sortBy = 'NAME_ASC';

  showCreateModal = false;
  showPriceModal = false;
  saving = false;
  selectedService?: ServiceCatalog;

  newService: CreateServiceRequest = {
    code: '',
    name: '',
    category: 'ENGINEERING',
    billingMethod: 'TIME',
    defaultUnit: 'hour',
    unitPrice: 100,
    taxRate: 19
  };

  priceUpdate: UpdatePriceRequest = {
    unitPrice: 0,
    taxRate: 19
  };

  ngOnInit() {
    this.loadCatalog();
  }

  loadCatalog() {
    this.loading = true;
    this.billingSvc.getServices().subscribe({
      next: (data) => {
        this.services = data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement du catalogue';
        this.loading = false;
      }
    });
  }

  // ─── Metrics ───
  get countEngineering(): number {
    return this.services.filter(s => s.category === 'ENGINEERING').length;
  }
  get countPrototyping(): number {
    return this.services.filter(s => s.category === 'PROTOTYPING').length;
  }
  get countManufacturing(): number {
    return this.services.filter(s => s.category === 'MANUFACTURING').length;
  }
  get countComponents(): number {
    return this.services.filter(s => s.category === 'COMPONENTS').length;
  }
  get countOther(): number {
    return this.services.filter(s => s.category === 'OTHER').length;
  }

  // ─── Filtered & Sorted Services ───
  get filteredServices(): ServiceCatalog[] {
    let result = [...this.services];

    if (this.selectedCategory !== 'ALL') {
      result = result.filter(s => s.category === this.selectedCategory);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(s => 
        s.code.toLowerCase().includes(term) || 
        s.name.toLowerCase().includes(term) ||
        this.getCategoryLabel(s.category).toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      switch (this.sortBy) {
        case 'NAME_ASC':
          return a.name.localeCompare(b.name);
        case 'CODE_ASC':
          return a.code.localeCompare(b.code);
        case 'PRICE_DESC':
          return (b.currentPrice?.unitPrice || 0) - (a.currentPrice?.unitPrice || 0);
        case 'PRICE_ASC':
          return (a.currentPrice?.unitPrice || 0) - (b.currentPrice?.unitPrice || 0);
        default:
          return 0;
      }
    });

    return result;
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      ENGINEERING: 'Ingénierie',
      PROTOTYPING: 'Prototypage',
      MANUFACTURING: 'Fabrication',
      COMPONENTS: 'Composants',
      OTHER: 'Autre'
    };
    return labels[category] || category;
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      ENGINEERING: '⚡',
      PROTOTYPING: '🔬',
      MANUFACTURING: '🏭',
      COMPONENTS: '📦',
      OTHER: '⚙️'
    };
    return icons[category] || '📋';
  }

  getCategoryBadgeClass(category: string): string {
    const classes: Record<string, string> = {
      ENGINEERING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      PROTOTYPING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      MANUFACTURING: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      COMPONENTS: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      OTHER: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    };
    return classes[category] || 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  }

  getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      TIME: 'Temps (Heures)',
      QUANTITY: 'Quantité (Pièces)',
      FIXED: 'Forfait (Projet)'
    };
    return labels[method] || method;
  }

  getMethodIcon(method: string): string {
    const icons: Record<string, string> = {
      TIME: '⏱️',
      QUANTITY: '🔢',
      FIXED: '🎯'
    };
    return icons[method] || '📄';
  }

  openCreateModal() {
    this.newService = {
      code: '',
      name: '',
      category: 'ENGINEERING',
      billingMethod: 'TIME',
      defaultUnit: 'hour',
      unitPrice: 100,
      taxRate: 19
    };
    this.showCreateModal = true;
  }

  saveService() {
    if (!this.newService.code || !this.newService.name) return;
    this.saving = true;
    this.billingSvc.createService(this.newService).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.saving = false;
        alert('Erreur: ' + (err.error?.message || 'Impossible de créer le service'));
      }
    });
  }

  openPriceModal(s: ServiceCatalog) {
    this.selectedService = s;
    this.priceUpdate = {
      unitPrice: s.currentPrice?.unitPrice || 0,
      taxRate: s.currentPrice?.taxRate || 19
    };
    this.showPriceModal = true;
  }

  savePrice() {
    if (!this.selectedService) return;
    this.saving = true;
    this.billingSvc.updateServicePrice(this.selectedService.id, this.priceUpdate).subscribe({
      next: () => {
        this.saving = false;
        this.showPriceModal = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.saving = false;
        alert('Erreur lors de la mise à jour du prix');
      }
    });
  }
}
