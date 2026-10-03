import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LotService } from '../../services/lot.service';
import { ComponentService } from '../../services/component.service';
import { SupplierService } from '../../services/supplier.service';
import { StorageLocationService } from '../../services/storage-location.service';
import { Lot, LotRequest, Component as StockComponent, Supplier, StorageLocation, LotLineRequest, ReelReceptionRequest, LotReceptionRequest } from '../../models/stock.models';

@Component({
  selector: 'app-lot-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lot-list.component.html',
})
export class LotListComponent implements OnInit {
  private lotSvc = inject(LotService);
  private compSvc = inject(ComponentService);
  private suppSvc = inject(SupplierService);
  private locSvc = inject(StorageLocationService);

  loading = true; error = '';
  lots: Lot[] = [];
  totalElements = 0; currentPage = 0; pageSize = 20;

  // Dropdowns
  allComponents: StockComponent[] = [];
  allSuppliers: Supplier[] = [];
  allLocations: StorageLocation[] = [];

  showModal = false; isEditing = false; saving = false; saveError = ''; editId = '';
  form: LotRequest = { supplierId: '', manufacturerLot: '', dateCode: '', status: 'COMMANDE', lines: [] };

  // Lot Reception flow
  showReceiveModal = false;
  receivingLot: Lot | null = null;
  receptionReels: ReelReceptionRequest[] = [];
  receptionError = '';
  validatingReception = false;
  loadingReception = false;
  activeComponentIdForReel: string | null = null;

  // Date constraint
  todayDate = new Date().toISOString().substring(0, 10);

  // Marque autocomplete
  allMarques: string[] = [];
  filteredMarques: string[] = [];
  showMarqueSuggestions = false;

  newReel: ReelReceptionRequest = { componentId: '', serialnumber: '', quantityInitial: 0, storageLocationId: '', marque: '', prix: undefined };

  // Adding lines to Lot
  newLineComponentId = '';
  newLineExpectedQuantity: number | null = null;


  ngOnInit() { this.load(); this.loadDropdowns(); }

  load() {
    this.loading = true;
    this.lotSvc.getLots(this.currentPage, this.pageSize).subscribe({
      next: (page) => { this.lots = page.content; this.totalElements = page.totalElements; this.loading = false; },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  loadDropdowns() {
    this.compSvc.getComponents(0, 500).subscribe({
      next: (p) => {
        this.allComponents = p.content;
        this.extractUniqueMarques();
      }
    });
    this.suppSvc.getSuppliers().subscribe({ next: (s) => this.allSuppliers = s });
    this.locSvc.getLocations().subscribe({ next: (locs) => this.allLocations = locs });
  }

  extractUniqueMarques() {
    const compManufacturers = (this.allComponents || [])
      .map(c => c.manufacturer)
      .filter((m): m is string => !!m && m.trim().length > 0);
    this.allMarques = Array.from(new Set(compManufacturers)).sort();
  }

  prevPage() { if (this.currentPage > 0) { this.currentPage--; this.load(); } }
  nextPage() { if ((this.currentPage + 1) * this.pageSize < this.totalElements) { this.currentPage++; this.load(); } }

  openCreate() {
    this.isEditing = false; this.editId = ''; this.saveError = '';
    this.form = { supplierId: '', manufacturerLot: '', dateCode: '', status: 'COMMANDE', lines: [] };
    this.newLineComponentId = '';
    this.newLineExpectedQuantity = null;
    this.showModal = true;
  }

  openEdit(l: Lot) {
    this.isEditing = true; this.editId = l.id; this.saveError = '';
    this.form = {
      supplierId: l.supplierId || '',
      manufacturerLot: l.manufacturerLot || '',
      dateCode: l.dateCode || '',
      status: l.status || 'COMMANDE',
      lines: l.lines ? l.lines.map(line => ({ componentId: line.componentId, expectedQuantity: line.expectedQuantity })) : [],
      estimatedDeliveryDate: l.estimatedDeliveryDate ? l.estimatedDeliveryDate.substring(0, 10) : undefined,
      receivedDate: l.receivedDate ? l.receivedDate.substring(0, 10) : undefined
    };
    this.newLineComponentId = '';
    this.newLineExpectedQuantity = null;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  addLine() {
    if (!this.newLineComponentId || !this.newLineExpectedQuantity || this.newLineExpectedQuantity <= 0) return;
    if (!this.form.lines) this.form.lines = [];
    const exists = this.form.lines.some(l => l.componentId === this.newLineComponentId);
    if (exists) {
      this.saveError = 'Ce composant est déjà dans les lignes.';
      return;
    }
    this.saveError = '';
    this.form.lines.push({
      componentId: this.newLineComponentId,
      expectedQuantity: this.newLineExpectedQuantity
    });
    this.newLineComponentId = '';
    this.newLineExpectedQuantity = null;
  }

  removeLine(index: number) {
    if (this.form.lines) {
      this.form.lines.splice(index, 1);
    }
  }

  getComponentMpn(componentId: string): string {
    const comp = this.allComponents.find(c => c.id === componentId);
    return comp ? `${comp.mpn} (${comp.manufacturer})` : componentId;
  }

  save() {
    this.saving = true; this.saveError = '';
    
    // Format dates to LocalDateTime string format
    const payload = { ...this.form };
    if (payload.estimatedDeliveryDate && payload.estimatedDeliveryDate.length === 10) {
      payload.estimatedDeliveryDate = payload.estimatedDeliveryDate + 'T00:00:00';
    }
    if (payload.receivedDate && payload.receivedDate.length === 10) {
      payload.receivedDate = payload.receivedDate + 'T00:00:00';
    }

    const obs = this.isEditing ? this.lotSvc.update(this.editId, payload) : this.lotSvc.create(payload);
    obs.subscribe({
      next: () => { this.saving = false; this.showModal = false; this.load(); },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }

  // --- RECEPTION FLOW ---
  openReceive(lot: Lot) {
    this.receptionError = '';
    this.showReceiveModal = true;
    this.loadingReception = true;
    this.activeComponentIdForReel = null;
    this.receivingLot = null;

    // Fetch fresh locations
    this.locSvc.getLocations().subscribe({ next: (locs) => this.allLocations = locs });

    // Fetch full lot details (with all lines) from backend
    this.lotSvc.getLot(lot.id).subscribe({
      next: (fullLot) => {
        this.receivingLot = fullLot;
        this.loadingReception = false;

        const saved = localStorage.getItem('lot_reception_reels_' + fullLot.id);
        if (saved) {
          try {
            this.receptionReels = JSON.parse(saved);
          } catch (e) {
            this.receptionReels = [];
          }
        } else {
          this.receptionReels = [];
        }
      },
      error: () => {
        this.receptionError = 'Impossible de charger les détails du lot.';
        this.loadingReception = false;
      }
    });
  }

  closeReceive() {
    this.showReceiveModal = false;
    this.receivingLot = null;
    this.receptionReels = [];
    this.activeComponentIdForReel = null;
  }

  openAddReel(componentId: string) {
    this.activeComponentIdForReel = componentId;
    const comp = this.allComponents.find(c => c.id === componentId);
    this.newReel = {
      componentId,
      serialnumber: '',
      quantityInitial: 0,
      storageLocationId: '',
      marque: comp?.manufacturer || '',
      prix: undefined
    };
  }

  closeAddReel() {
    this.activeComponentIdForReel = null;
    this.showMarqueSuggestions = false;
  }

  // --- MARQUE AUTOCOMPLETE ---
  onMarqueInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.newReel.marque = val;
    this.filterMarques(val);
  }

  onMarqueFocus() {
    const val = this.newReel.marque || '';
    this.filterMarques(val);
    this.showMarqueSuggestions = true;
  }

  onMarqueBlur() {
    setTimeout(() => {
      this.showMarqueSuggestions = false;
    }, 200);
  }

  selectMarque(m: string) {
    this.newReel.marque = m;
    this.showMarqueSuggestions = false;
  }

  private filterMarques(query: string) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filteredMarques = [...this.allMarques];
    } else {
      this.filteredMarques = this.allMarques.filter(m => m.toLowerCase().includes(q));
    }
  }

  // --- LOCATION HELPERS ---
  isLocationFree(loc: StorageLocation): boolean {
    if (loc.slotStatus !== 'LIBRE') return false;
    // Check if this location is already selected by another reel in the current reception list
    return !this.receptionReels.some(r => r.storageLocationId === loc.id);
  }

  locationIcon(loc: StorageLocation): string {
    switch (loc.slotStatus) {
      case 'LIBRE':        return '🟢';
      case 'OCCUPE':       return '🔴';
      case 'CIBLE_ACTIVE': return '🟡';
      default:             return '⚪';
    }
  }

  saveNewReel() {
    if (!this.newReel.serialnumber || !this.newReel.quantityInitial || this.newReel.quantityInitial <= 0 || !this.newReel.storageLocationId || !this.newReel.marque || this.newReel.prix == null || this.newReel.prix < 0) {
      return;
    }

    if (this.receivingLot && this.receivingLot.lines) {
      const line = this.receivingLot.lines.find(l => l.componentId === this.newReel.componentId);
      if (line) {
        const remaining = line.remainingQuantity !== undefined ? line.remainingQuantity : (line.expectedQuantity - (line.receivedQuantity || 0));
        const currentInBatch = this.getReelTotalQtyForComponent(this.newReel.componentId);
        if (currentInBatch + this.newReel.quantityInitial > remaining) {
          this.receptionError = `La quantité totale saisie (${currentInBatch + this.newReel.quantityInitial}) dépasse le reste à recevoir (${remaining}) pour ce composant.`;
          return;
        }
      }
    }

    this.receptionError = '';
    this.receptionReels.push({ ...this.newReel });
    if (this.receivingLot) {
      localStorage.setItem('lot_reception_reels_' + this.receivingLot.id, JSON.stringify(this.receptionReels));
    }
    this.closeAddReel();
  }

  removeReel(index: number) {
    this.receptionReels.splice(index, 1);
    if (this.receivingLot) {
      localStorage.setItem('lot_reception_reels_' + this.receivingLot.id, JSON.stringify(this.receptionReels));
    }
  }

  getReelsForComponent(componentId: string): ReelReceptionRequest[] {
    return this.receptionReels.filter(r => r.componentId === componentId);
  }

  getReelTotalQtyForComponent(componentId: string): number {
    return this.getReelsForComponent(componentId).reduce((sum, r) => sum + (r.quantityInitial || 0), 0);
  }

  getLocationPath(locId: string): string {
    const loc = this.allLocations.find(l => l.id === locId);
    return loc ? (loc.fullPath || loc.warehouse) : locId;
  }

  isLotReadyToReceive(): boolean {
    if (!this.receivingLot || !this.receivingLot.lines || this.receivingLot.lines.length === 0) return false;
    if (this.receptionReels.length === 0) return false;

    for (const line of this.receivingLot.lines) {
      const remaining = line.remainingQuantity !== undefined ? line.remainingQuantity : (line.expectedQuantity - (line.receivedQuantity || 0));
      const totalBatchQty = this.getReelTotalQtyForComponent(line.componentId);
      if (totalBatchQty > remaining) {
        return false;
      }
    }
    return true;
  }

  resetReceptionInput() {
    if (confirm('Voulez-vous vraiment réinitialiser la saisie des bobines pour ce lot ?')) {
      this.receptionReels = [];
      if (this.receivingLot) {
        localStorage.removeItem('lot_reception_reels_' + this.receivingLot.id);
      }
    }
  }

  validateReception() {
    if (!this.receivingLot) return;
    this.validatingReception = true;
    this.receptionError = '';
    
    this.lotSvc.receiveLot(this.receivingLot.id, { reels: this.receptionReels }).subscribe({
      next: () => {
        if (this.receivingLot) {
          localStorage.removeItem('lot_reception_reels_' + this.receivingLot.id);
        }
        this.validatingReception = false;
        this.closeReceive();
        this.load();
      },
      error: (e) => {
        this.validatingReception = false;
        this.receptionError = e.error?.message || 'Une erreur est survenue lors de la validation.';
      }
    });
  }
}

