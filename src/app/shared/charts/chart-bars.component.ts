import {
  Component,
  Input,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartBase } from './chart-base';
import { ChartTooltipComponent } from './chart-tooltip.component';
import {
  ChartSeries,
  TooltipState,
  TOOLTIP_HIDDEN,
  seriesColor,
  niceScale,
  axisTicks,
  formatCompact,
  formatFull,
} from './chart.models';

interface Barre {
  x: number; y: number; l: number; h: number;
  couleur: string; serie: string; categorie: string; valeur: number;
}

/**
 * Barres verticales, une ou plusieurs séries côte à côte.
 *
 * Les barres partent toujours de zéro : tronquer l'axe multiplierait
 * visuellement un écart de quelques pourcents, ce qu'une longueur — contrairement
 * à une position sur une courbe — ne permet pas de rattraper à la lecture.
 */
@Component({
  selector: 'app-chart-bars',
  standalone: true,
  imports: [CommonModule, ChartTooltipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-hote" [style.height.px]="hauteur">
      <svg [attr.width]="largeur()" [attr.height]="hauteur"
           role="img" [attr.aria-label]="resumeAccessible()">

        <g>
          <line *ngFor="let t of graduations()"
                [attr.x1]="marge.gauche" [attr.x2]="largeur() - marge.droite"
                [attr.y1]="yDe(t)" [attr.y2]="yDe(t)"
                stroke="hsl(var(--border))" stroke-width="1"
                [attr.stroke-dasharray]="t === 0 ? null : '3 4'"
                [attr.opacity]="t === 0 ? 0.9 : 0.45" />
          <text *ngFor="let t of graduations()"
                [attr.x]="marge.gauche - 8" [attr.y]="yDe(t) + 3.5"
                text-anchor="end" class="chart-axe">{{ formatCompact(t) }}</text>
        </g>

        <!-- Extrémité arrondie côté valeur seulement : le pied de la barre
             reste net sur la ligne de base, sinon la longueur paraît plus
             courte qu'elle ne l'est. -->
        <g *ngFor="let b of barres(); let i = index">
          <path [attr.d]="cheminBarre(b)" [attr.fill]="b.couleur"
                class="chart-barre"
                (mouseenter)="survol(b)" (mouseleave)="quitte()" />
        </g>

        <text *ngFor="let e of etiquettes()"
              [attr.x]="e.x" [attr.y]="hauteur - marge.bas + 16"
              text-anchor="middle" class="chart-axe">{{ e.texte }}</text>
      </svg>

      <app-chart-tooltip [etat]="infobulle()" />
    </div>

    <div class="chart-legende" *ngIf="_series().length > 1">
      <span class="chart-legende__item" *ngFor="let s of _series(); let i = index">
        <span class="chart-legende__puce" [style.background]="seriesColor(i, s.color)"></span>{{ s.name }}
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .chart-hote { position: relative; width: 100%; }
    svg { display: block; overflow: visible; }
    .chart-axe {
      font-size: 10px; fill: hsl(var(--muted-foreground));
      font-variant-numeric: tabular-nums;
    }
    .chart-barre {
      transition: opacity 0.15s ease;
      cursor: default;
    }
    .chart-barre:hover { opacity: 0.78; }
    .chart-legende {
      display: flex; flex-wrap: wrap; gap: 0.75rem;
      margin-top: 0.625rem; padding-left: 0.25rem;
    }
    .chart-legende__item {
      display: inline-flex; align-items: center; gap: 0.35rem;
      font-size: 11px; font-weight: 600; color: hsl(var(--muted-foreground));
    }
    .chart-legende__puce { width: 9px; height: 9px; border-radius: 3px; }
  `],
})
export class ChartBarsComponent extends ChartBase {
  @Input({ required: true }) set series(v: ChartSeries[]) { this._series.set(v ?? []); }
  @Input({ required: true }) set categories(v: string[]) { this._categories.set(v ?? []); }
  @Input() hauteur = 200;
  @Input() unite = '';
  @Input() decimales = 0;

  readonly _series = signal<ChartSeries[]>([]);
  private readonly _categories = signal<string[]>([]);
  readonly infobulle = signal<TooltipState>(TOOLTIP_HIDDEN);

  readonly marge = { haut: 14, droite: 12, bas: 26, gauche: 42 };
  protected readonly formatCompact = formatCompact;
  protected readonly seriesColor = seriesColor;

  private readonly echelle = computed(() =>
    niceScale(Math.max(...this._series().flatMap((s) => s.values), 0), 4));

  readonly graduations = computed(() => {
    const { max, step } = this.echelle();
    return axisTicks(max, step);
  });

  readonly barres = computed<Barre[]>(() => {
    const series = this._series();
    const cats = this._categories();
    if (!series.length || !cats.length) return [];

    const utile = this.largeur() - this.marge.gauche - this.marge.droite;
    const parGroupe = utile / cats.length;
    // Le groupe n'occupe que 70 % de son pas : le reste est la respiration
    // qui sépare visuellement deux catégories.
    const largeurGroupe = parGroupe * 0.7;
    // 2 px de fond entre deux barres voisines — sans quoi deux couleurs
    // proches se lisent comme une seule barre bicolore.
    const ecart = series.length > 1 ? 2 : 0;
    const largeurBarre = Math.max(
      2,
      (largeurGroupe - ecart * (series.length - 1)) / series.length,
    );
    const base = this.hauteur - this.marge.bas;

    const out: Barre[] = [];
    cats.forEach((_, j) => {
      const debut = this.marge.gauche + j * parGroupe + (parGroupe - largeurGroupe) / 2;
      series.forEach((s, i) => {
        const v = s.values[j] ?? 0;
        const y = this.yDe(v);
        out.push({
          x: debut + i * (largeurBarre + ecart),
          y,
          l: largeurBarre,
          h: Math.max(0, base - y),
          couleur: seriesColor(i, s.color),
          serie: s.name,
          categorie: cats[j],
          valeur: v,
        });
      });
    });
    return out;
  });

  readonly etiquettes = computed(() => {
    const cats = this._categories();
    const utile = this.largeur() - this.marge.gauche - this.marge.droite;
    const parGroupe = utile / Math.max(cats.length, 1);
    const saut = parGroupe >= 34 ? 1 : parGroupe >= 20 ? 2 : 3;
    return cats
      .map((texte, j) => ({ texte, j, x: this.marge.gauche + (j + 0.5) * parGroupe }))
      .filter(({ j }) => j === 0 || j === cats.length - 1 || j % saut === 0);
  });

  readonly resumeAccessible = computed(() => {
    const noms = this._series().map((s) => s.name).join(', ');
    return `Répartition de ${noms} sur ${this._categories().length} catégories`;
  });

  yDe(v: number): number {
    const { max } = this.echelle();
    const utile = this.hauteur - this.marge.haut - this.marge.bas;
    return this.hauteur - this.marge.bas - (v / max) * utile;
  }

  /**
   * Un chemin plutôt qu'un `<rect>` arrondi : seuls les deux coins du haut
   * doivent l'être. Le rayon se réduit sur une barre très basse, sinon
   * l'arrondi mangerait toute sa hauteur.
   */
  cheminBarre(b: Barre): string {
    if (b.h <= 0.5) return '';
    const r = Math.min(4, b.l / 2, b.h);
    const { x, y, l, h } = b;
    return `M${x} ${y + h} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} ` +
           `L${x + l - r} ${y} Q${x + l} ${y} ${x + l} ${y + r} L${x + l} ${y + h} Z`;
  }

  survol(b: Barre): void {
    this.infobulle.set({
      visible: true,
      x: b.x + b.l / 2,
      y: b.y,
      title: b.categorie,
      rows: [{
        name: b.serie,
        value: formatFull(b.valeur, this.decimales) + (this.unite ? ' ' + this.unite : ''),
        color: b.couleur,
      }],
    });
  }

  quitte(): void {
    this.infobulle.set(TOOLTIP_HIDDEN);
  }
}
