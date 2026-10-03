import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashIconComponent } from './dash-icon.component';
import { ChartSparklineComponent } from '../charts/chart-sparkline.component';

/** Le ton d'une tuile : il choisit la teinte de l'icône et de la lueur. */
export type TonTuile = 'primary' | 'accent' | 'success' | 'warning' | 'destructive';

export interface StatTile {
  label: string;
  /** Déjà formatée : la tuile affiche, elle ne calcule pas. */
  value: string;
  icon: string;
  ton: TonTuile;
  /** Sous-titre : ce que le chiffre ne dit pas (« 12 ce mois », « 8 urgents »). */
  sub?: string;
  /** Variation affichée telle quelle — « +12 % », « -0,8 j ». */
  change?: string;
  /**
   * Sens de la variation.
   *
   * Distinct du signe : un délai de livraison qui baisse est une bonne
   * nouvelle. C'est l'appelant qui sait dans quel sens lire sa mesure.
   */
  up?: boolean;
  /** Micro-courbe de tendance. Omise quand il n'y a pas d'historique. */
  spark?: number[];
  /** Destination au clic. Sans elle, la tuile n'est pas cliquable. */
  lien?: string;
}

/**
 * La tuile chiffrée des tableaux de bord.
 *
 * Extraite du gabarit de l'administration pour que les trois tableaux de bord
 * partagent exactement la même carte — et que le sens d'une flèche verte y
 * soit décidé à un seul endroit.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule, DashIconComponent, ChartSparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi-card relative overflow-hidden group cursor-pointer h-full flex flex-col justify-between"
         style="min-height: 148px;">
      <!-- Top Accent Line (Client KPI style) -->
      <div class="absolute top-0 left-0 right-0 h-[2px]" [style.background]="accentGradient"></div>

      <!-- Hover Glow Ambient -->
      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
           [style.background]="'radial-gradient(ellipse at top left, ' + iconBg + ', transparent 70%)'"></div>

      <div class="flex items-start justify-between mb-2 relative z-10">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 shadow-sm"
             [style.background]="iconBg"
             [style.border]="'1px solid ' + iconBorderColor"
             [style.color]="iconColor">
          <app-dash-icon [nom]="tuile.icon" [taille]="17" />
        </div>

        <span *ngIf="tuile.change"
              [ngClass]="tuile.up ? 'badge-success' : 'badge-destructive'"
              class="badge text-[10px] shrink-0 font-bold">
          {{ tuile.up ? '↑' : '↓' }} {{ tuile.change }}
        </span>
      </div>

      <div class="relative z-10">
        <p class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-0.5 font-['Outfit'] tabular-nums">
          {{ tuile.value }}
        </p>
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ tuile.label }}</p>
      </div>

      <div class="mt-3 relative z-10 mt-auto pt-2">
        <app-chart-sparkline *ngIf="tuile.spark?.length"
                             [valeurs]="tuile.spark!"
                             [couleur]="sparkColor"
                             [hauteur]="26" />
        <p class="text-[10px] text-muted-foreground/80 font-medium mt-1 truncate" *ngIf="tuile.sub">{{ tuile.sub }}</p>
      </div>
    </div>
  `,
})
export class StatTileComponent {
  @Input({ required: true }) tuile!: StatTile;

  get accentGradient(): string {
    switch (this.tuile.ton) {
      case 'primary': return 'linear-gradient(90deg, #3b82f6, #6366f1, transparent)';
      case 'accent': return 'linear-gradient(90deg, #06b6d4, #3b82f6, transparent)';
      case 'success': return 'linear-gradient(90deg, #10b981, #14b8a6, transparent)';
      case 'warning': return 'linear-gradient(90deg, #f59e0b, #f97316, transparent)';
      case 'destructive': return 'linear-gradient(90deg, #f43f5e, #ef4444, transparent)';
      default: return 'linear-gradient(90deg, #3b82f6, #6366f1, transparent)';
    }
  }

  get iconBorderColor(): string {
    switch (this.tuile.ton) {
      case 'primary': return 'rgba(59, 130, 246, 0.25)';
      case 'accent': return 'rgba(6, 182, 212, 0.25)';
      case 'success': return 'rgba(16, 185, 129, 0.25)';
      case 'warning': return 'rgba(245, 158, 11, 0.25)';
      case 'destructive': return 'rgba(239, 68, 68, 0.25)';
      default: return 'rgba(59, 130, 246, 0.25)';
    }
  }

  get iconColor(): string {
    switch (this.tuile.ton) {
      case 'primary': return '#2563eb';
      case 'accent': return '#0891b2';
      case 'success': return '#059669';
      case 'warning': return '#d97706';
      case 'destructive': return '#dc2626';
      default: return '#2563eb';
    }
  }

  get iconBg(): string {
    switch (this.tuile.ton) {
      case 'primary': return 'rgba(59, 130, 246, 0.1)';
      case 'accent': return 'rgba(6, 182, 212, 0.1)';
      case 'success': return 'rgba(16, 185, 129, 0.1)';
      case 'warning': return 'rgba(245, 158, 11, 0.1)';
      case 'destructive': return 'rgba(239, 68, 68, 0.1)';
      default: return 'rgba(59, 130, 246, 0.1)';
    }
  }

  get sparkColor(): string {
    switch (this.tuile.ton) {
      case 'primary': return '#3b82f6';
      case 'accent': return '#06b6d4';
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'destructive': return '#ef4444';
      default: return '#3b82f6';
    }
  }
}
