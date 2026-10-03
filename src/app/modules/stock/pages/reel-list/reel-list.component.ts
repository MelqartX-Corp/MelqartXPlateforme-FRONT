import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ReelService } from '../../services/reel.service';
import { LotService } from '../../services/lot.service';
import { StorageLocationService } from '../../services/storage-location.service';
import { ComponentService } from '../../services/component.service';
import { Reel, ReelRequest, ReelStatus, ReelProductionState, Lot, StorageLocation, Component as StockComponent, ComponentStockSummary } from '../../models/stock.models';
import { AuthService } from '../../../../services/auth/auth.service';

@Component({
  selector: 'app-reel-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reel-list.component.html',
})
export class ReelListComponent implements OnInit {
  private reelSvc = inject(ReelService);
  private lotSvc  = inject(LotService);
  private locSvc  = inject(StorageLocationService);
  private compSvc = inject(ComponentService);
  private auth    = inject(AuthService);

  loading = true; error = '';
  reels: Reel[] = [];
  totalElements = 0; currentPage = 0; pageSize = 20;
  /**
   * L'atelier ne cherche pas « INTACT » ou « OUVERT » : il cherche où est la
   * bobine. Une bobine entamée rangée en production et la même bobine montée
   * sur une machine ont le même statut et ne se font pas du tout.
   */
  activeTab: 'all' | ReelProductionState = 'all';

  // Filters
  filterSerial = '';
  filterLotId = '';
  filterLocationId = '';

  // Stock summary
  stockSummary: ComponentStockSummary[] = [];

  // Dropdowns for create
  allLots: Lot[] = [];
  allLocations: StorageLocation[] = [];
  allComponents: StockComponent[] = [];

  // Create modal
  showCreateModal = false;
  saving = false; saveError = '';
  createForm: ReelRequest = { lotId: '', componentId: '', serialnumber: '', quantityInitial: 0 };

  // Edit modal
  showEditModal = false;
  editingReel?: Reel;
  editForm: Partial<ReelRequest> = {};

  // Marque autocomplete
  allMarques: string[] = [];
  filteredMarques: string[] = [];
  showMarqueSuggestions = false;
  activeMarqueField: 'create' | 'edit' | '' = '';

  ngOnInit() { this.load(); this.loadDropdowns(); }

  loadDropdowns() {
    this.lotSvc.getLots(0, 500).subscribe({ next: (p) => this.allLots = p.content });
    this.locSvc.getLocations().subscribe({ next: (l) => this.allLocations = l });
    this.compSvc.getComponents(0, 500).subscribe({
      next: (p) => {
        this.allComponents = p.content;
        this.extractUniqueMarques();
      }
    });
    this.reelSvc.getStockSummary().subscribe({ next: (s) => this.stockSummary = s });
  }

  get totalReels(): number { return this.stockSummary.reduce((s, c) => s + c.reelCount, 0); }
  get totalPieces(): number { return this.stockSummary.reduce((s, c) => s + c.totalQuantityRemaining, 0); }
  usagePercentSummary(s: ComponentStockSummary): number { return s.totalQuantityInitial ? Math.round((s.totalQuantityRemaining / s.totalQuantityInitial) * 100) : 0; }

  load() {
    this.loading = true;
    let obs;
    if (this.filterSerial) {
      obs = this.reelSvc.getBySerialNumber(this.filterSerial, this.currentPage, this.pageSize);
    } else if (this.filterLotId) {
      obs = this.reelSvc.getByLotId(this.filterLotId, this.currentPage, this.pageSize);
    } else if (this.filterLocationId) {
      obs = this.reelSvc.getByStorageLocationId(this.filterLocationId, this.currentPage, this.pageSize);
    } else if (this.activeTab !== 'all') {
      obs = this.reelSvc.getByProductionState(this.activeTab, this.currentPage, this.pageSize);
    } else {
      obs = this.reelSvc.getReels(this.currentPage, this.pageSize);
    }
    obs.subscribe({
      next: (page) => {
        this.reels = page.content;
        this.totalElements = page.totalElements;
        this.loading = false;
        this.extractUniqueMarques();
      },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  extractUniqueMarques() {
    const reelMarques = this.reels
      .map(r => r.marque)
      .filter((m): m is string => !!m && m.trim().length > 0);
    const compManufacturers = (this.allComponents || [])
      .map(c => c.manufacturer)
      .filter((m): m is string => !!m && m.trim().length > 0);
    this.allMarques = Array.from(new Set([...compManufacturers, ...reelMarques])).sort();
  }

  onComponentSelect(componentId: string) {
    const comp = this.allComponents.find(c => c.id === componentId);
    if (comp && comp.manufacturer) {
      this.createForm.marque = comp.manufacturer;
    }
  }

  onMarqueInput(event: Event, field: 'create' | 'edit') {
    const val = (event.target as HTMLInputElement).value;
    if (field === 'create') {
      this.createForm.marque = val;
    } else {
      this.editForm.marque = val;
    }
    this.filterMarques(val);
  }

  onMarqueFocus(field: 'create' | 'edit') {
    this.activeMarqueField = field;
    const val = field === 'create' ? (this.createForm.marque || '') : (this.editForm.marque || '');
    this.filterMarques(val);
    this.showMarqueSuggestions = true;
  }

  onMarqueBlur() {
    setTimeout(() => {
      this.showMarqueSuggestions = false;
      this.activeMarqueField = '';
    }, 200);
  }

  selectMarque(m: string, field: 'create' | 'edit') {
    if (field === 'create') {
      this.createForm.marque = m;
    } else {
      this.editForm.marque = m;
    }
    this.showMarqueSuggestions = false;
    this.activeMarqueField = '';
  }

  private filterMarques(query: string) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filteredMarques = [...this.allMarques];
    } else {
      this.filteredMarques = this.allMarques.filter(m => m.toLowerCase().includes(q));
    }
  }

  search() { this.currentPage = 0; this.load(); }
  clearFilters() { this.filterSerial = ''; this.filterLotId = ''; this.filterLocationId = ''; this.activeTab = 'all'; this.currentPage = 0; this.load(); }
  get hasActiveFilter(): boolean { return !!(this.filterSerial || this.filterLotId || this.filterLocationId); }

  switchTab(tab: 'all' | ReelProductionState) { this.activeTab = tab; this.currentPage = 0; this.load(); }
  prevPage() { if (this.currentPage > 0) { this.currentPage--; this.load(); } }
  nextPage() { if ((this.currentPage + 1) * this.pageSize < this.totalElements) { this.currentPage++; this.load(); } }

  statusEmoji(s: string): string { return s === 'INTACT' ? '🟢' : s === 'OUVERT' ? '🟠' : '🔴'; }
  statusLabel(s: string): string { return s === 'INTACT' ? 'Intact' : s === 'OUVERT' ? 'Ouvert' : 'Vide'; }
  statusBg(s: string): string { return s === 'INTACT' ? 'hsl(var(--success)/0.1)' : s === 'OUVERT' ? 'hsl(var(--warning)/0.1)' : 'hsl(var(--destructive)/0.1)'; }
  statusColor(s: string): string { return s === 'INTACT' ? 'hsl(var(--success))' : s === 'OUVERT' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'; }
  usagePercent(r: Reel): number { return r.quantityInitial ? Math.round((r.quantityRemaining / r.quantityInitial) * 100) : 0; }

  /** Création : seuls les emplacements LIBRE sont sélectionnables. */
  isLocationFree(loc: StorageLocation): boolean {
    return loc.slotStatus === 'LIBRE';
  }

  /** Édition : LIBRE ou emplacement actuel de la bobine en cours d'édition. */
  isLocationAvailableForEdit(loc: StorageLocation): boolean {
    if (this.editingReel && loc.id === this.editingReel.storageLocationId) return true;
    return loc.slotStatus === 'LIBRE';
  }

  locationIcon(loc: StorageLocation, currentLocId?: string): string {
    if (currentLocId && loc.id === currentLocId) return '📍';
    switch (loc.slotStatus) {
      case 'LIBRE':        return '🟢';
      case 'OCCUPE':       return '🔴';
      case 'CIBLE_ACTIVE': return '🟡';
      default:             return '⚪';
    }
  }

  // Create
  openCreate() {
    this.saveError = '';
    this.createForm = { lotId: '', componentId: '', serialnumber: '', quantityInitial: 0, storageLocationId: '', marque: '', prix: undefined };
    this.showCreateModal = true;
  }

  saveCreate() {
    this.saving = true; this.saveError = '';
    this.reelSvc.create(this.createForm).subscribe({
      next: () => { this.saving = false; this.showCreateModal = false; this.load(); this.loadDropdowns(); },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }

  // Edit
  openEdit(r: Reel) {
    this.editingReel = r;
    this.saveError = '';
    this.editForm = {
      storageLocationId: r.storageLocationId,
      quantityRemaining: r.status === 'OUVERT' ? r.quantityRemaining : undefined,
      marque: r.marque,
      prix: r.prix
    };
    this.showEditModal = true;
  }

  saveEdit() {
    if (!this.editingReel) return;
    this.saving = true; this.saveError = '';
    this.reelSvc.update(this.editingReel.id, this.editForm).subscribe({
      next: () => { this.saving = false; this.showEditModal = false; this.load(); },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }

  // Delete
  showDeleteModal = false;
  deletingId = '';
  deleting = false;

  confirmDelete(id: string) { this.deletingId = id; this.showDeleteModal = true; }
  cancelDelete() { this.showDeleteModal = false; this.deletingId = ''; }
  doDelete() {
    this.deleting = true;
    this.reelSvc.delete(this.deletingId).subscribe({
      next: () => { this.deleting = false; this.showDeleteModal = false; this.loadDropdowns(); this.load(); },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }

  closeModal() { this.showCreateModal = false; this.showEditModal = false; }

  // ── Atelier : lecture seule ici ────────────────────────────────

  /**
   * Réception et rangement appartiennent à l'appro ; sortir les bobines et
   * décompter appartient à l'atelier, depuis l'écran de production. Un
   * technicien lit cette page, il n'y crée ni ne supprime rien.
   */
  get canManage(): boolean {
    const role = this.auth.role;
    return role === 'APPRO' || role === 'ADMINISTRATEUR';
  }

  stateLabel(r: Reel): string {
    switch (r.productionState) {
      case 'EN_MAGASIN':          return 'Magasin';
      case 'EN_STOCK_PRODUCTION': return 'Stock production';
      case 'EN_MACHINE':
      case 'OCCUPEE':             return 'En machine';
      case 'EPUISEE':             return 'Vide';
      default:                    return '—';
    }
  }

  stateColor(r: Reel): string {
    switch (r.productionState) {
      case 'EN_MAGASIN':          return 'hsl(var(--success))';
      case 'EN_STOCK_PRODUCTION': return 'hsl(var(--primary))';
      case 'EN_MACHINE':
      case 'OCCUPEE':             return 'hsl(var(--warning))';
      default:                    return 'hsl(var(--muted-foreground))';
    }
  }

  stateBg(r: Reel): string {
    switch (r.productionState) {
      case 'EN_MAGASIN':          return 'hsl(var(--success)/0.12)';
      case 'EN_STOCK_PRODUCTION': return 'hsl(var(--primary)/0.12)';
      case 'EN_MACHINE':
      case 'OCCUPEE':             return 'hsl(var(--warning)/0.12)';
      default:                    return 'hsl(var(--muted)/0.4)';
    }
  }

  /** Où elle est, en une ligne — case de rangement, ou projet qui la retient. */
  whereIs(r: Reel): string {
    if (r.currentProjetId) {
      return 'Projet ' + (r.currentProjetNom || r.currentProjetId);
    }
    return r.locationFullPath || '—';
  }
}
