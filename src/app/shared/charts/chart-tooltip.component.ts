import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipState } from './chart.models';

/**
 * L'infobulle partagée par tous les graphiques.
 *
 * En HTML et non en SVG : le texte y reste net à toute échelle, hérite des
 * polices de l'application et se stylise avec les mêmes jetons que le reste
 * de l'interface.
 */
@Component({
  selector: 'app-chart-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="etat.visible"
      class="chart-tooltip"
      [style.left.px]="etat.x"
      [style.top.px]="etat.y">
      <p class="chart-tooltip__titre">{{ etat.title }}</p>
      <div class="chart-tooltip__ligne" *ngFor="let ligne of etat.rows">
        <span class="chart-tooltip__puce" [style.background]="ligne.color"></span>
        <span class="chart-tooltip__nom">{{ ligne.name }}</span>
        <span class="chart-tooltip__valeur">{{ ligne.value }}</span>
      </div>
    </div>
  `,
  styles: [`
    .chart-tooltip {
      position: absolute;
      z-index: 30;
      /* Ancrée au-dessus du point et centrée : le curseur ne masque jamais
         la valeur qu'on vient lire. */
      transform: translate(-50%, calc(-100% - 12px));
      pointer-events: none;
      min-width: 8.5rem;
      padding: 0.5rem 0.625rem;
      border-radius: 0.625rem;
      background: hsl(var(--popover));
      border: 1px solid hsl(var(--border));
      box-shadow: 0 8px 24px -6px rgb(0 0 0 / 0.18), 0 2px 6px -2px rgb(0 0 0 / 0.12);
      font-size: 11px;
      line-height: 1.45;
      white-space: nowrap;
    }
    .chart-tooltip__titre {
      font-weight: 700;
      color: hsl(var(--foreground));
      margin-bottom: 0.3rem;
      font-size: 11px;
    }
    .chart-tooltip__ligne {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .chart-tooltip__puce {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    /* Le texte porte les jetons d'encre, jamais la couleur de la série :
       la pastille suffit à porter l'identité, et un libellé coloré perdrait
       en contraste. */
    .chart-tooltip__nom {
      color: hsl(var(--muted-foreground));
      margin-right: auto;
    }
    .chart-tooltip__valeur {
      font-weight: 700;
      color: hsl(var(--foreground));
      font-variant-numeric: tabular-nums;
    }
  `],
})
export class ChartTooltipComponent {
  @Input({ required: true }) etat!: TooltipState;
}
