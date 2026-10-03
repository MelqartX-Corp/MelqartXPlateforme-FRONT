import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ComponentService } from '../../services/component.service';
import { ProductionStockService } from '../../services/production-stock.service';
import { SupplierService } from '../../services/supplier.service';
import { ReelService } from '../../services/reel.service';
import { LotService } from '../../services/lot.service';
import { Reel, Lot, ComponentStockSummary, KittingLine } from '../../models/stock.models';

@Component({
  selector: 'app-stock-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
})
export class StockDashboardComponent implements OnInit {
  private componentSvc = inject(ComponentService);
  private supplierSvc  = inject(SupplierService);
  private reelSvc      = inject(ReelService);
  private lotSvc       = inject(LotService);
  private prodSvc      = inject(ProductionStockService);

  loading = true;
  error = '';

  totalComponents = 0;
  totalSuppliers  = 0;
  totalReels      = 0;
  reelsMagasin    = 0;
  // « Ouvert » dit qu'une bobine est entamee, pas qu'elle est sur une machine :
  // une bobine entamee et rangee au magasin etait comptee en production. Le
  // seul chiffre qui repond a « ou est-elle » est currentProjetId, et c'est
  // exactement ce que renvoie /reservations/in-machine.
  reelsProduction = 0;
  enMachine: KittingLine[] = [];
  /** Bobines entamees, machine ou magasin — ce que « Ouvert » veut vraiment dire. */
  reelsOuvertes   = 0;

  recentLots: Lot[] = [];
  criticalReels: Reel[] = [];
  stockSummary: ComponentStockSummary[] = [];

  // Donut chart
  donutCircumference = 2 * Math.PI * 16;

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading = true;
    forkJoin({
      components: this.componentSvc.getComponents(0, 1),
      suppliers:  this.supplierSvc.getSuppliers(),
      allReels:   this.reelSvc.getReels(0, 1),
      magasin:    this.reelSvc.getByStatus('INTACT', 0, 1),
      production: this.reelSvc.getByStatus('OUVERT', 0, 1),
      machine:    this.prodSvc.inMachine().pipe(catchError(() => of([] as KittingLine[]))),
      lots:       this.lotSvc.getLots(0, 5),
      reelsForCritical: this.reelSvc.getReels(0, 100),
      stockSummary: this.reelSvc.getStockSummary(),
    }).subscribe({
      next: (data) => {
        this.totalComponents = data.components.totalElements;
        this.totalSuppliers  = data.suppliers.length;
        this.totalReels      = data.allReels.totalElements;
        this.reelsMagasin    = data.magasin.totalElements;
        this.enMachine       = data.machine;
        this.reelsProduction = data.machine.length;
        this.reelsOuvertes   = data.production.totalElements;
        this.recentLots      = data.lots.content;
        this.criticalReels   = data.reelsForCritical.content
          .filter(r => r.quantityRemaining < r.quantityInitial * 0.1 && r.status !== 'VIDE')
          .slice(0, 5);
        this.stockSummary    = data.stockSummary;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur de chargement du dashboard stock';
        this.loading = false;
      }
    });
  }

  get magasinPercent(): number {
    return this.totalReels ? Math.round((this.reelsMagasin / this.totalReels) * 100) : 0;
  }

  criticalPercent(r: Reel): number {
    return r.quantityInitial ? Math.round((r.quantityRemaining / r.quantityInitial) * 100) : 0;
  }

  getTimeAgo(date: string | undefined): string {
    if (!date) return '—';
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days}j`;
    return new Date(date).toLocaleDateString('fr-FR');
  }

  get totalPieces(): number { return this.stockSummary.reduce((s, c) => s + c.totalQuantityRemaining, 0); }

  /** Pieces mises de cote pour des projets payes : presentes, mais promises. */
  get totalReserve(): number {
    return this.stockSummary.reduce((total, s) => total + (s.totalQuantityReserved ?? 0), 0);
  }

  /** Pieces reellement a prendre — le seul chiffre qui engage une commande. */
  get totalDisponible(): number {
    return this.stockSummary.reduce((total, s) => total + this.disponible(s), 0);
  }

  reserve(s: ComponentStockSummary): number {
    return s.totalQuantityReserved ?? 0;
  }

  disponible(s: ComponentStockSummary): number {
    const detaille = (s.intactQuantityAvailable ?? 0) + (s.ouvertQuantityAvailable ?? 0);
    if (detaille > 0) return detaille;
    return Math.max(0, s.totalQuantityRemaining - this.reserve(s));
  }

  /** Part engagee d'une reference, pour la barre du tableau. */
  partReservee(s: ComponentStockSummary): number {
    if (s.totalQuantityRemaining <= 0) return 0;
    return Math.min(100, Math.round((this.reserve(s) / s.totalQuantityRemaining) * 100));
  }

  /** Pieces immobilisees sur les machines, tous projets confondus. */
  get piecesEnMachine(): number {
    return this.enMachine.reduce((total, l) => total + l.quantityForProject, 0);
  }
  usagePercentSummary(s: ComponentStockSummary): number { return s.totalQuantityInitial ? Math.round((s.totalQuantityRemaining / s.totalQuantityInitial) * 100) : 0; }
}
