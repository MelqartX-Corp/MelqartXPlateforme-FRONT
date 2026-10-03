import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { BillingService } from '../../services/billing.service';
import { ManufacturingParams, MarginTier, ServiceCatalog } from '../../models/billing.models';

/** Codes des trois tarifs de fabrication, tels que semés dans le catalogue. */
const CODE_MACHINE = 'TARIF_MACHINE_SMT';
const CODE_TECH_MACHINE = 'TARIF_TECHNICIEN_MACHINE';
const CODE_TECH_SOUDURE = 'TARIF_TECHNICIEN_SOUDURE';

/**
 * Réglages de l'atelier.
 *
 * Ces valeurs ne sont pas des prix : ce sont les constantes physiques de la
 * ligne SMT. Elles ne se créent pas — il n'y a qu'une ligne, donc un seul jeu
 * de réglages, qu'on ajuste quand l'atelier change d'équipement.
 *
 * Le parti pris de l'écran : ne jamais afficher un paramètre nu. Chaque
 * réglage est montré avec son effet sur une carte témoin, recalculé en direct,
 * parce qu'un « 5500 CPH » ne dit rien tant qu'on ne voit pas les dinars
 * qu'il déplace.
 */
@Component({
  selector: 'app-admin-manufacturing-params',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-manufacturing-params.component.html',
  styleUrl: './admin-manufacturing-params.component.css'
})
export class AdminManufacturingParamsComponent implements OnInit {

  private billing = inject(BillingService);

  params: ManufacturingParams | null = null;
  /** Copie de référence : sert à savoir si quelque chose a bougé. */
  private pristine = '';

  loading = true;
  saving = false;
  error: string | null = null;
  saved = false;

  // ── Tarifs, lus au catalogue (lecture seule ici) ──
  tarifMachine = 0;
  tarifTechMachine = 0;
  tarifTechSoudure = 0;
  tarifsManquants: string[] = [];

  /**
   * Carte témoin de l'aperçu. Volontairement figée : un point de comparaison
   * ne sert que s'il ne bouge pas quand on change les réglages.
   */
  readonly temoin = { smd: 181, thtPins: 24, quantite: 10 };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.billing.getManufacturingParams().subscribe({
      next: params => {
        this.params = params;
        this.pristine = JSON.stringify(params);
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || "Impossible de charger les réglages d'atelier.";
      }
    });

    this.billing.getServices().subscribe({
      next: services => this.readTarifs(services),
      error: () => { /* L'écran reste utilisable sans l'aperçu chiffré. */ }
    });
  }

  private readTarifs(services: ServiceCatalog[]): void {
    const byCode = new Map(services.map(s => [s.code, s]));
    const manquants: string[] = [];

    const price = (code: string, label: string): number => {
      const service = byCode.get(code);
      const unit = service?.currentPrice?.unitPrice;
      if (unit === undefined || unit === null) {
        manquants.push(label);
        return 0;
      }
      return Number(unit);
    };

    this.tarifMachine = price(CODE_MACHINE, 'Ligne SMT');
    this.tarifTechMachine = price(CODE_TECH_MACHINE, 'Technicien — conduite');
    this.tarifTechSoudure = price(CODE_TECH_SOUDURE, 'Technicien — soudure');
    this.tarifsManquants = manquants;
  }

  save(): void {
    if (!this.params || this.saving) return;
    this.saving = true;
    this.error = null;
    this.saved = false;

    this.billing.updateManufacturingParams(this.params).subscribe({
      next: updated => {
        this.params = updated;
        this.pristine = JSON.stringify(updated);
        this.saving = false;
        this.saved = true;
      },
      error: err => {
        this.saving = false;
        // Les règles de cohérence des tranches remontent en clair du serveur :
        // trou entre deux tranches, plafond manquant sur la dernière…
        this.error = err?.error?.message || "L'enregistrement a échoué.";
      }
    });
  }

  reset(): void {
    if (!this.pristine) return;
    this.params = JSON.parse(this.pristine);
    this.saved = false;
    this.error = null;
  }

  get dirty(): boolean {
    return !!this.params && JSON.stringify(this.params) !== this.pristine;
  }

  onEdit(): void {
    this.saved = false;
  }

  // ── Tranches de marge ──

  addTier(): void {
    if (!this.params) return;
    const tiers = this.params.marginTiers ?? (this.params.marginTiers = []);
    const last = tiers[tiers.length - 1];

    // La nouvelle tranche démarre juste après la précédente, et l'ancienne
    // dernière reçoit un plafond : sans ça le serveur refuserait deux tranches
    // ouvertes à l'infini.
    if (last && last.maxQty === null) {
      last.maxQty = last.minQty + 9;
    }
    const minQty = last ? (last.maxQty ?? last.minQty) + 1 : 1;
    tiers.push({ minQty, maxQty: null, marginPercent: 10 });
    this.onEdit();
  }

  removeTier(index: number): void {
    if (!this.params?.marginTiers) return;
    this.params.marginTiers.splice(index, 1);

    // La dernière tranche doit toujours rester ouverte, sinon une grande
    // quantité n'aurait aucune marge applicable.
    const tiers = this.params.marginTiers;
    if (tiers.length) {
      tiers[tiers.length - 1].maxQty = null;
    }
    this.onEdit();
  }

  tierLabel(tier: MarginTier): string {
    return tier.maxQty === null
      ? `${tier.minQty} pièces et plus`
      : `${tier.minQty} à ${tier.maxQty} pièces`;
  }

  // ══════════════════════════════════════════════════════════
  //  Aperçu : ce que les réglages font à une carte témoin
  //  Reproduit exactement la chaîne ms-bom → ms-billing.
  // ══════════════════════════════════════════════════════════

  /** Temps de pose des composants SMD, en secondes. */
  get apercuTempsSmt(): number {
    const cph = this.params?.machineSpeedCph || 0;
    return cph > 0 ? (this.temoin.smd / cph) * 3600 : 0;
  }

  /** Temps machine d'une carte : pose + convoyage. */
  get apercuTempsMachineCarte(): number {
    return this.apercuTempsSmt + (this.params?.conveyorTimeSec || 0);
  }

  get apercuTempsSoudureCarte(): number {
    return this.temoin.thtPins * (this.params?.timePerThtPinSec || 0);
  }

  get apercuTempsCarte(): number {
    return this.apercuTempsMachineCarte + this.apercuTempsSoudureCarte;
  }

  /**
   * Heures machine de la série — strictement proportionnelles à la quantité.
   *
   * Rien ne s'ajoute au démarrage : la préparation de la machine n'est pas
   * facturée, une série de 5 cartes coûte donc exactement le dixième d'une
   * série de 50.
   */
  get apercuHeuresMachine(): number {
    return (this.temoin.quantite * this.apercuTempsMachineCarte) / 3600;
  }

  get apercuHeuresSoudure(): number {
    return (this.temoin.quantite * this.apercuTempsSoudureCarte) / 3600;
  }

  get apercuCoutMachine(): number {
    return this.apercuHeuresMachine * this.tarifMachine;
  }

  get apercuCoutTechMachine(): number {
    return this.apercuHeuresMachine * (this.params?.technicianRatio ?? 1) * this.tarifTechMachine;
  }

  get apercuCoutTechSoudure(): number {
    return this.apercuHeuresSoudure * this.tarifTechSoudure;
  }

  /** Fabrication seule — les composants ne dépendent pas de ces réglages. */
  get apercuTotalFabrication(): number {
    return this.apercuCoutMachine + this.apercuCoutTechMachine + this.apercuCoutTechSoudure;
  }

  get apercuParCarte(): number {
    return this.temoin.quantite > 0 ? this.apercuTotalFabrication / this.temoin.quantite : 0;
  }


  get apercuCartesParHeure(): number {
    return this.apercuTempsCarte > 0 ? 3600 / this.apercuTempsCarte : 0;
  }

  get apercuDisponible(): boolean {
    return this.tarifsManquants.length === 0 && this.tarifMachine > 0;
  }

  formatSeconds(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return '—';
    const s = Math.round(totalSeconds);
    if (s < 60) return `${s} s`;
    const minutes = Math.floor(s / 60);
    if (minutes < 60) return `${minutes} min ${String(s % 60).padStart(2, '0')} s`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  }
}
