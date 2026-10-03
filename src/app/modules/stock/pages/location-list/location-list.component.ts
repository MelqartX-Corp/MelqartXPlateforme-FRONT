import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StorageLocationService } from '../../services/storage-location.service';
import { StorageLocation, StorageLocationRequest } from '../../models/stock.models';

@Component({
  selector: 'app-location-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-list.component.html',
})
export class LocationListComponent implements OnInit {
  private svc = inject(StorageLocationService);
  private router = inject(Router);
  loading = true; error = '';
  locations: StorageLocation[] = [];
  groupedLocations: { warehouse: string; locations: StorageLocation[] }[] = [];
  showModal = false; isEditing = false; saving = false; saveError = ''; editId = '';
  form: StorageLocationRequest = { warehouse: '' as any };
  showDeleteModal = false; deletingId = ''; deleting = false;

  // ── Selected location for detail panel ──
  selectedLocation: StorageLocation | null = null;

  // ── Warehouse map ──
  warehouseRacks: { name: string; slots: { id: string; fullPath: string; isSelected: boolean; hasContent: boolean }[] }[] = [];

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getLocations().subscribe({
      next: (data) => {
        this.locations = data;
        this.buildGroups();
        this.buildWarehouseMap();
        this.loading = false;
      },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  private buildGroups() {
    const map = new Map<string, StorageLocation[]>();
    for (const l of this.locations) {
      const key = l.warehouse || 'Autres';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    this.groupedLocations = Array.from(map.entries())
      .map(([warehouse, locations]) => ({ warehouse, locations }))
      .sort((a, b) => a.warehouse.localeCompare(b.warehouse));
  }

  private buildWarehouseMap() {
    // Group locations by rack within the first warehouse for the map visual
    const rackMap = new Map<string, StorageLocation[]>();
    for (const l of this.locations) {
      const rackKey = l.rack || 'Défaut';
      if (!rackMap.has(rackKey)) rackMap.set(rackKey, []);
      rackMap.get(rackKey)!.push(l);
    }
    this.warehouseRacks = Array.from(rackMap.entries())
      .map(([name, locs]) => ({
        name,
        slots: locs.map(l => ({
          id: l.id,
          fullPath: l.fullPath || l.warehouse,
          isSelected: this.selectedLocation?.id === l.id,
          hasContent: !!(l.zone || l.shelf || l.slot)
        }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  selectLocation(l: StorageLocation) {
    this.selectedLocation = this.selectedLocation?.id === l.id ? null : l;
    this.buildWarehouseMap();
  }

  // ── Breadcrumb segments ──
  getPathSegments(l: StorageLocation): { label: string; type: string; icon: string }[] {
    const segs: { label: string; type: string; icon: string }[] = [];
    if (l.warehouse) segs.push({ label: l.warehouse, type: 'Entrepôt', icon: 'warehouse' });
    if (l.zone) segs.push({ label: l.zone, type: 'Zone', icon: 'zone' });
    if (l.rack) segs.push({ label: l.rack, type: 'Rack', icon: 'rack' });
    if (l.shelf) segs.push({ label: l.shelf, type: 'Étagère', icon: 'shelf' });
    if (l.slot) segs.push({ label: l.slot, type: 'Slot', icon: 'slot' });
    return segs;
  }

  // ── Stats ──
  get totalWarehouses(): number {
    return new Set(this.locations.map(l => l.warehouse)).size;
  }
  get totalRacks(): number {
    return new Set(this.locations.filter(l => l.rack).map(l => l.rack)).size;
  }
  get totalSlots(): number {
    return this.locations.filter(l => l.slot).length;
  }

  navigateToDetail(l: StorageLocation) { this.router.navigate(['/stock/locations', l.id]); }
  openCreate() { this.isEditing = false; this.editId = ''; this.saveError = ''; this.form = { warehouse: '' as any, zone: '', rack: '', shelf: '', slot: '' }; this.showModal = true; }
  openEdit(l: StorageLocation) { this.isEditing = true; this.editId = l.id; this.saveError = ''; this.form = { warehouse: l.warehouse, zone: l.zone, rack: l.rack, shelf: l.shelf, slot: l.slot }; this.showModal = true; }
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
      next: () => { this.deleting = false; this.showDeleteModal = false; this.selectedLocation = null; this.load(); },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }
}
