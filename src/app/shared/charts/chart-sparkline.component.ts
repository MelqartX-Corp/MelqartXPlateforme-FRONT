import { Component, Input, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Micro-courbe de tuile : une tendance, pas une mesure.
 *
 * Ni axe ni graduation, volontairement — à cette taille ils seraient
 * illisibles et donneraient à croire qu'on peut y lire une valeur. Le chiffre
 * exact est déjà écrit en grand juste au-dessus ; la courbe ne répond qu'à
 * « ça monte ou ça descend ? ».
 */
@Component({
  selector: 'app-chart-sparkline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + L + ' ' + H" preserveAspectRatio="none"
         class="spark" [style.height.px]="hauteur" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="id" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="couleur" stop-opacity="0.32" />
          <stop offset="100%" [attr.stop-color]="couleur" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path *ngIf="aire()" [attr.d]="aire()" [attr.fill]="'url(#' + id + ')'" />
      <path [attr.d]="ligne()" fill="none" [attr.stroke]="couleur"
            stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"
            vector-effect="non-scaling-stroke" />
      <circle *ngIf="dernier() as d" [attr.cx]="d.x" [attr.cy]="d.y" r="2"
              [attr.fill]="couleur" />
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .spark { display: block; width: 100%; overflow: visible; }
  `],
})
export class ChartSparklineComponent {
  @Input({ required: true }) set valeurs(v: number[]) { this._valeurs.set(v ?? []); }
  @Input() couleur = 'var(--series-1)';
  @Input() hauteur = 28;

  private readonly _valeurs = signal<number[]>([]);
  protected readonly L = 100;
  protected readonly H = 32;
  protected readonly id = 'spark-' + Math.random().toString(36).slice(2, 8);

  private readonly points = computed(() => {
    const v = this._valeurs();
    if (v.length < 2) return [];
    const min = Math.min(...v);
    const max = Math.max(...v);
    // Une série plate doit donner une ligne médiane, pas une division par zéro.
    const amplitude = max - min || 1;
    const marge = 3;
    return v.map((val, i) => ({
      x: (i / (v.length - 1)) * this.L,
      y: this.H - marge - ((val - min) / amplitude) * (this.H - marge * 2),
    }));
  });

  readonly ligne = computed(() =>
    this.points().map((p, i) => `${i === 0 ? 'M' : 'L'}${r(p.x)} ${r(p.y)}`).join(' '));

  readonly aire = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    return `M${r(pts[0].x)} ${this.H} ` +
      pts.map((p) => `L${r(p.x)} ${r(p.y)}`).join(' ') +
      ` L${r(pts[pts.length - 1].x)} ${this.H} Z`;
  });

  readonly dernier = computed(() => {
    const pts = this.points();
    return pts.length ? pts[pts.length - 1] : null;
  });
}

function r(v: number): number {
  return Math.round(v * 100) / 100;
}
