import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReelService } from '../../services/reel.service';
import { StorageLocationService } from '../../services/storage-location.service';
import { ProductionStockService } from '../../services/production-stock.service';
import { Reel, ReelRequest, StorageLocation, StockMovement } from '../../models/stock.models';
import { AuthService } from '../../../../services/auth/auth.service';

@Component({
  selector: 'app-reel-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './reel-detail.component.html',
})
export class ReelDetailComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private reelSvc = inject(ReelService);
  private locSvc  = inject(StorageLocationService);
  private prodSvc = inject(ProductionStockService);
  private auth    = inject(AuthService);

  get canManage(): boolean {
    const role = this.auth.role;
    return role === 'APPRO' || role === 'ADMINISTRATEUR';
  }

  loading = true; error = '';
  reel?: Reel;

  // Edit modal
  showEditModal = false;
  saving = false; saveError = '';
  editForm: Partial<ReelRequest> = {};
  allLocations: StorageLocation[] = [];

  // SVG circle circumference (radius=18)
  circumference = 2 * Math.PI * 18;

  /**
   * L'historique de la bobine — ce qu'elle a servi, quand, pour qui.
   *
   * C'est lui qui rend le stock verifiable : quantityRemaining doit valoir
   * quantityInitial moins la somme des consommations. Un ecart est un
   * incident, pas un arrondi.
   */
  movements: StockMovement[] = [];
  movementsLoading = false;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadReel(id);
    this.loadMovements(id);
    this.locSvc.getLocations().subscribe({ next: (l) => this.allLocations = l });
  }

  loadMovements(id: string) {
    this.movementsLoading = true;
    this.prodSvc.movements(id).subscribe({
      next: (m) => { this.movements = m; this.movementsLoading = false; },
      error: () => { this.movements = []; this.movementsLoading = false; }
    });
  }

  /** Total reellement consomme, tous projets confondus. */
  get totalConsomme(): number {
    return this.movements
      .filter(m => m.type === 'CONSUMPTION' || m.type === 'THT_ISSUE')
      .reduce((total, m) => total + m.quantity, 0);
  }

  movementLabel(m: StockMovement): string {
    switch (m.type) {
      case 'ISSUE':       return 'Sortie vers production';
      case 'CONSUMPTION': return 'Retour et decompte';
      case 'THT_ISSUE':   return 'Sortie traversant';
      case 'ADJUSTMENT':  return 'Correction inventaire';
      case 'SCRAP':       return 'Mise au rebut';
      default:            return m.type;
    }
  }

  movementColor(m: StockMovement): string {
    switch (m.type) {
      case 'ISSUE':       return 'hsl(var(--primary))';
      case 'CONSUMPTION':
      case 'THT_ISSUE':   return 'hsl(var(--accent))';
      case 'SCRAP':       return 'hsl(var(--destructive))';
      default:            return 'hsl(var(--muted-foreground))';
    }
  }

  /** Un emplacement est sélectionnable s'il est LIBRE ou si c'est l'emplacement actuel de la bobine. */
  isLocationAvailable(loc: StorageLocation): boolean {
    if (loc.id === this.reel?.storageLocationId) return true; // emplacement actuel → toujours sélectionnable
    return loc.slotStatus === 'LIBRE';
  }

  locationStatusIcon(loc: StorageLocation): string {
    if (loc.id === this.reel?.storageLocationId) return '📍'; // emplacement actuel
    switch (loc.slotStatus) {
      case 'LIBRE':        return '🟢';
      case 'OCCUPE':       return '🔴';
      case 'CIBLE_ACTIVE': return '🟡';
      default:             return '⚪';
    }
  }

  loadReel(id: string) {
    this.loading = true;
    this.reelSvc.getReel(id).subscribe({
      next: (r) => { this.reel = r; this.loading = false; },
      error: () => { this.error = 'Bobine introuvable'; this.loading = false; }
    });
  }

  statusEmoji(s: string): string { return s === 'INTACT' ? '🟢' : s === 'OUVERT' ? '🟠' : '🔴'; }
  statusLabel(s: string): string { return s === 'INTACT' ? 'Intact' : s === 'OUVERT' ? 'Ouvert' : 'Vide'; }
  statusBg(s: string): string { return s === 'INTACT' ? 'hsl(var(--success)/0.12)' : s === 'OUVERT' ? 'hsl(var(--warning)/0.12)' : 'hsl(var(--destructive)/0.12)'; }
  statusGradient(s: string): string {
    if (s === 'INTACT') return 'linear-gradient(90deg, hsl(var(--success)), hsl(var(--success)/0.3))';
    if (s === 'OUVERT') return 'linear-gradient(90deg, hsl(var(--warning)), hsl(var(--warning)/0.3))';
    return 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive)/0.3))';
  }

  get usagePercent(): number {
    if (!this.reel || !this.reel.quantityInitial) return 0;
    return Math.round((this.reel.quantityRemaining / this.reel.quantityInitial) * 100);
  }

  get consumed(): number {
    if (!this.reel) return 0;
    return this.reel.quantityInitial - this.reel.quantityRemaining;
  }

  openEdit() {
    if (!this.reel) return;
    this.saveError = '';
    this.editForm = {
      storageLocationId: this.reel.storageLocationId,
      quantityRemaining: this.reel.quantityRemaining,
      status: this.reel.status,
      marque: this.reel.marque,
      prix: this.reel.prix
    };
    this.showEditModal = true;
  }

  closeEdit() { this.showEditModal = false; }

  saveEdit() {
    if (!this.reel) return;
    this.saving = true; this.saveError = '';
    this.reelSvc.update(this.reel.id, this.editForm).subscribe({
      next: (updated) => {
        this.reel = updated;
        this.saving = false;
        this.showEditModal = false;
      },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }
}
