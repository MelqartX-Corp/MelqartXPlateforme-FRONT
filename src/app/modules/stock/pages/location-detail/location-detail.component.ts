import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageLocationService } from '../../services/storage-location.service';
import { StorageLocation, SlotStatus } from '../../models/stock.models';

export interface RackSlot {
  isHighlighted: boolean;
  slotStatus: SlotStatus | null; // null = aucune location réelle
  locationId?: string;
}
export interface ShelfRow  { label: string; slots: RackSlot[]; }
export interface RackCol   { name: string; isActive: boolean; bottomLabel: string; shelves: ShelfRow[]; }
export interface StepItem  { type: string; label: string; icon: string; num: string; isActive: boolean; }
export interface DetailRow { icon: string; label: string; value: string; blue: boolean; }

@Component({
  selector: 'app-location-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-detail.component.html',
})
export class LocationDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc   = inject(StorageLocationService);

  loading = true; error = '';
  location: StorageLocation | null = null;
  allSiblings: StorageLocation[] = []; // toutes les locations du même warehouse

  steps:       StepItem[]  = [];
  detailRows:  DetailRow[] = [];
  rackCols:    RackCol[]   = [];
  shelfLabels: string[]    = ['ÉTAGE-D','ÉTAGE-C','ÉTAGE-B','ÉTAGE-A'];

  updatingStatus = false;
  lastUpdated = '';

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.svc.getLocation(id).subscribe({
        next: l => {
          this.location = l;
          // Charger les siblings pour la zone view
          this.svc.getLocations(l.warehouse).subscribe({
            next: siblings => {
              this.allSiblings = siblings;
              this.build();
              this.loading = false;
            },
            error: () => { this.build(); this.loading = false; }
          });
        },
        error: () => { this.error = 'Chargement impossible'; this.loading = false; }
      });
    } else { this.error = 'ID manquant'; this.loading = false; }
  }

  private build() {
    this.buildSteps();
    this.buildDetails();
    this.buildRacks();
    const n = new Date();
    this.lastUpdated = `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }

  private buildSteps() {
    const l = this.location!;
    const raw = [
      l.warehouse && { type:'Entrepôt', label:l.warehouse, icon:'warehouse' },
      l.zone      && { type:'Zone',     label:l.zone,      icon:'zone'      },
      l.rack      && { type:'Rack',     label:l.rack,      icon:'rack'      },
      l.shelf     && { type:'Étagère',  label:l.shelf,     icon:'shelf'     },
      l.slot      && { type:'Case',     label:l.slot,      icon:'slot'      },
    ].filter(Boolean) as { type:string; label:string; icon:string }[];
    this.steps = raw.map((r,i) => ({ ...r, num: String(i+1).padStart(2,'0'), isActive: i === raw.length-1 }));
  }

  private buildDetails() {
    const l = this.location!;
    this.detailRows = [
      l.warehouse && { icon:'warehouse', label:'Entrepôt', value:l.warehouse, blue:false },
      l.zone      && { icon:'zone',      label:'Zone',     value:l.zone,      blue:true  },
      l.rack      && { icon:'rack',      label:'Rack',     value:l.rack,      blue:false },
      l.shelf     && { icon:'shelf',     label:'Étagère',  value:l.shelf,     blue:false },
      l.slot      && { icon:'slot',      label:'Case',     value:l.slot,      blue:true  },
    ].filter(Boolean) as DetailRow[];
  }

  private buildRacks() {
    const l = this.location!;
    const currentRackNum = parseInt((l.rack || 'Rack-01').replace(/\D/g,'')) || 1;
    const pad = (n: number) => String(n).padStart(2,'0');
    const start = Math.max(1, currentRackNum - 1);

    // Map: rackNum → shelfLetter → locations[]
    const rackShelfMap = new Map<number, Map<string, StorageLocation[]>>();
    for (const sibling of this.allSiblings) {
      const rn = parseInt((sibling.rack || '').replace(/\D/g,'')) || 0;
      const sl = (sibling.shelf || '').toUpperCase().match(/([A-D])$/)?.[1] || '_';
      if (!rackShelfMap.has(rn)) rackShelfMap.set(rn, new Map());
      const shelfMap = rackShelfMap.get(rn)!;
      if (!shelfMap.has(sl)) shelfMap.set(sl, []);
      shelfMap.get(sl)!.push(sibling);
    }

    const shelfLetterMap: Record<string, number> = { 'D': 0, 'C': 1, 'B': 2, 'A': 3 };
    const shelfIndexToLetter = ['D', 'C', 'B', 'A'];

    this.rackCols = [0, 1, 2].map(off => {
      const rn = start + off;
      const isActive = rn === currentRackNum;
      const shelfMap = rackShelfMap.get(rn) || new Map<string, StorageLocation[]>();

      return {
        name: `RACK-${pad(rn)}`,
        isActive,
        bottomLabel: String(10 + rn),
        shelves: this.shelfLabels.map((lbl, si) => {
          const letter = shelfIndexToLetter[si];
          const locsOnShelf = shelfMap.get(letter) || [];

          // 3 slot cells per shelf row
          const slots: RackSlot[] = [0, 1, 2].map(ci => {
            const loc = locsOnShelf[ci];
            if (!loc) return { isHighlighted: false, slotStatus: null };
            return {
              isHighlighted: loc.id === l.id,
              slotStatus: loc.slotStatus || 'LIBRE',
              locationId: loc.id
            };
          });

          return { label: lbl, slots };
        }),
      };
    });
  }

  // ── Slot click → navigate to that location ──
  onSlotClick(slot: RackSlot) {
    if (!slot.locationId) return;
    if (slot.isHighlighted) return; // c'est la page actuelle
    this.router.navigate(['/stock/locations', slot.locationId]);
  }

  // ── Slot background color by status ──
  slotBg(slot: RackSlot): string {
    if (!slot.slotStatus) return ''; // empty slot — laisser le CSS gérer
    if (slot.isHighlighted) {
      const map: Record<string, string> = {
        LIBRE: 'rgba(34,197,94,0.35)',
        OCCUPE: 'rgba(239,68,68,0.35)',
        CIBLE_ACTIVE: 'rgba(234,179,8,0.35)',
      };
      return map[slot.slotStatus] || '';
    }
    const map: Record<string, string> = {
      LIBRE: 'rgba(34,197,94,0.15)',
      OCCUPE: 'rgba(239,68,68,0.15)',
      CIBLE_ACTIVE: 'rgba(234,179,8,0.15)',
    };
    return map[slot.slotStatus] || '';
  }

  slotBorder(slot: RackSlot): string {
    if (!slot.slotStatus) return '';
    const map: Record<string, string> = {
      LIBRE: 'rgba(34,197,94,0.5)',
      OCCUPE: 'rgba(239,68,68,0.5)',
      CIBLE_ACTIVE: 'rgba(234,179,8,0.5)',
    };
    const color = map[slot.slotStatus] || '';
    return slot.isHighlighted ? `2px solid ${color}` : `1px solid ${color}`;
  }

  slotIconColor(slot: RackSlot): string {
    const map: Record<string, string> = {
      LIBRE: '#16a34a',
      OCCUPE: '#ef4444',
      CIBLE_ACTIVE: '#ca8a04',
    };
    return map[slot.slotStatus || ''] || '#60A5FA';
  }

  // ── Status management ──
  setStatus(status: SlotStatus) {
    if (!this.location || this.updatingStatus) return;
    this.updatingStatus = true;
    this.svc.updateStatus(this.location.id, status).subscribe({
      next: (updated) => {
        this.location = updated;
        // Mettre à jour le sibling correspondant
        const idx = this.allSiblings.findIndex(s => s.id === updated.id);
        if (idx >= 0) this.allSiblings[idx] = updated;
        this.buildRacks();
        this.updatingStatus = false;
      },
      error: () => { this.updatingStatus = false; }
    });
  }

  // ── Getters ──
  get slotStatusLabel(): string {
    const map: Record<string, string> = { LIBRE: 'Libre', OCCUPE: 'Occupé', CIBLE_ACTIVE: 'Cible active' };
    return map[this.location?.slotStatus || 'LIBRE'] || 'Libre';
  }

  get slotStatusColor(): string {
    const map: Record<string, string> = { LIBRE: 'hsl(var(--success))', OCCUPE: '#ef4444', CIBLE_ACTIVE: '#ca8a04' };
    return map[this.location?.slotStatus || 'LIBRE'] || 'hsl(var(--success))';
  }

  get occupationText(): string {
    const count = this.location?.reelCount || 0;
    return count === 0 ? 'Vide' : `${count} bobine${count > 1 ? 's' : ''}`;
  }

  get activeRackLabel() { return this.rackCols.find(r => r.isActive)?.name.replace('RACK-','Rack-') || ''; }

  goBack() { this.router.navigate(['/stock/locations']); }
}
