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

interface Point { x: number; y: number; v: number; }
interface Trace {
  nom: string;
  couleur: string;
  pointille: boolean;
  aire: boolean;
  ligne: string;
  surface: string;
  points: Point[];
}

/**
 * Courbe ou aire, une à quatre séries, avec repère et infobulle au survol.
 *
 * Un seul axe des ordonnées, toujours : superposer deux échelles ferait
 * varier la position relative des courbes selon un cadrage arbitraire, et
 * n'importe quelle corrélation pourrait alors y être lue ou effacée. Deux
 * mesures d'ordres différents demandent deux graphiques.
 */
@Component({
  selector: 'app-chart-area',
  standalone: true,
  imports: [CommonModule, ChartTooltipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-hote" [style.height.px]="hauteur">
      <svg
        [attr.width]="largeur()"
        [attr.height]="hauteur"
        role="img"
        [attr.aria-label]="resumeAccessible()"
        (mousemove)="survol($event)"
        (mouseleave)="quitte()">

        <defs>
          <linearGradient *ngFor="let t of traces(); let i = index"
                          [attr.id]="idGradient(i)" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="t.couleur" stop-opacity="0.28" />
            <stop offset="100%" [attr.stop-color]="t.couleur" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Grille horizontale : discrète, elle sert à comparer des hauteurs
             sans jamais concurrencer les données. -->
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

        <!-- Repère vertical : il relie le point survolé à son libellé d'axe. -->
        <line *ngIf="indexActif() !== null"
              [attr.x1]="xDe(indexActif()!)" [attr.x2]="xDe(indexActif()!)"
              [attr.y1]="marge.haut" [attr.y2]="hauteur - marge.bas"
              stroke="hsl(var(--foreground))" stroke-width="1"
              stroke-dasharray="3 3" opacity="0.28" />

        <g *ngFor="let t of traces(); let i = index">
          <path *ngIf="t.aire" [attr.d]="t.surface" [attr.fill]="'url(#' + idGradient(i) + ')'" />
          <path [attr.d]="t.ligne" fill="none" [attr.stroke]="t.couleur"
                stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
                [attr.stroke-dasharray]="t.pointille ? '5 4' : null" />
        </g>

        <!-- Marqueurs du point survolé. L'anneau à la couleur de la surface
             détache le point de la courbe qui passe dessous. -->
        <g *ngIf="indexActif() !== null">
          <circle *ngFor="let t of traces()"
                  [attr.cx]="t.points[indexActif()!].x"
                  [attr.cy]="t.points[indexActif()!].y"
                  r="4.5" [attr.fill]="t.couleur"
                  stroke="hsl(var(--card))" stroke-width="2" />
        </g>

        <!-- Libellés de l'axe des abscisses, éclaircis pour éviter le
             chevauchement sur une carte étroite. -->
        <text *ngFor="let etiquette of etiquettesVisibles()"
              [attr.x]="etiquette.x" [attr.y]="hauteur - marge.bas + 16"
              text-anchor="middle" class="chart-axe">{{ etiquette.texte }}</text>
      </svg>

      <app-chart-tooltip [etat]="infobulle()" />
    </div>

    <!-- Deux séries ou plus : la légende est obligatoire, l'identité ne peut
         pas reposer sur la seule couleur. -->
    <div class="chart-legende" *ngIf="traces().length > 1">
      <span class="chart-legende__item" *ngFor="let t of traces()">
        <span class="chart-legende__puce" [style.background]="t.couleur"></span>{{ t.nom }}
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .chart-hote { position: relative; width: 100%; }
    svg { display: block; overflow: visible; }
    .chart-axe {
      font-size: 10px;
      fill: hsl(var(--muted-foreground));
      font-variant-numeric: tabular-nums;
    }
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
export class ChartAreaComponent extends ChartBase {
  @Input({ required: true }) set series(v: ChartSeries[]) { this._series.set(v ?? []); }
  @Input({ required: true }) set categories(v: string[]) { this._categories.set(v ?? []); }
  @Input() hauteur = 200;
  /** Unité affichée dans l'infobulle — « TND », « tickets »… */
  @Input() unite = '';
  /** Décimales de l'infobulle. L'axe reste toujours en notation compacte. */
  @Input() decimales = 0;

  private readonly _series = signal<ChartSeries[]>([]);
  private readonly _categories = signal<string[]>([]);
  readonly indexActif = signal<number | null>(null);
  readonly infobulle = signal<TooltipState>(TOOLTIP_HIDDEN);

  readonly marge = { haut: 14, droite: 12, bas: 26, gauche: 42 };
  protected readonly formatCompact = formatCompact;

  /** Échelle commune : le maximum de toutes les séries, arrondi au rond supérieur. */
  private readonly echelle = computed(() => {
    const toutes = this._series().flatMap((s) => s.values);
    return niceScale(Math.max(...toutes, 0), 4);
  });

  readonly graduations = computed(() => {
    const { max, step } = this.echelle();
    return axisTicks(max, step);
  });

  readonly traces = computed<Trace[]>(() => {
    const series = this._series();
    const n = this._categories().length;
    if (!series.length || n === 0) return [];

    return series.map((s, i) => {
      const couleur = seriesColor(i, s.color);
      const points: Point[] = s.values.map((v, j) => ({
        x: this.xDe(j),
        y: this.yDe(v),
        v,
      }));

      const ligne = points
        .map((p, j) => `${j === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
        .join(' ');

      const base = this.hauteur - this.marge.bas;
      const surface = points.length
        ? `M${round(points[0].x)} ${round(base)} ` +
          points.map((p) => `L${round(p.x)} ${round(p.y)}`).join(' ') +
          ` L${round(points[points.length - 1].x)} ${round(base)} Z`
        : '';

      return {
        nom: s.name,
        couleur,
        pointille: !!s.dashed,
        // Une seule aire remplie : deux surfaces superposées se masquent.
        aire: s.area ?? series.length === 1,
        ligne,
        surface,
        points,
      };
    });
  });

  /**
   * Un libellé sur deux — ou sur trois — quand la place manque.
   *
   * Le premier et le dernier sont toujours conservés : ce sont eux qui
   * bornent la période, et une série qui commencerait sans date serait
   * illisible.
   */
  readonly etiquettesVisibles = computed(() => {
    const cats = this._categories();
    if (!cats.length) return [];
    const largeurUtile = this.largeur() - this.marge.gauche - this.marge.droite;
    const parEtiquette = largeurUtile / cats.length;
    const saut = parEtiquette >= 34 ? 1 : parEtiquette >= 20 ? 2 : 3;

    return cats
      .map((texte, i) => ({ texte, i, x: this.xDe(i) }))
      .filter(({ i }) => i === 0 || i === cats.length - 1 || i % saut === 0);
  });

  readonly resumeAccessible = computed(() => {
    const noms = this._series().map((s) => s.name).join(', ');
    const cats = this._categories();
    if (!cats.length) return 'Graphique sans données';
    return `Évolution de ${noms} de ${cats[0]} à ${cats[cats.length - 1]}`;
  });

  xDe(i: number): number {
    const n = this._categories().length;
    const utile = this.largeur() - this.marge.gauche - this.marge.droite;
    // Un point unique se pose au centre plutôt qu'au bord gauche.
    if (n <= 1) return this.marge.gauche + utile / 2;
    return this.marge.gauche + (i / (n - 1)) * utile;
  }

  yDe(v: number): number {
    const { max } = this.echelle();
    const utile = this.hauteur - this.marge.haut - this.marge.bas;
    return this.hauteur - this.marge.bas - (v / max) * utile;
  }

  idGradient(i: number): string {
    return `aire-${this.idUnique}-${i}`;
  }

  /** Plusieurs graphiques par page : les identifiants de dégradé doivent différer. */
  private readonly idUnique = Math.random().toString(36).slice(2, 8);

  survol(evt: MouseEvent): void {
    const cats = this._categories();
    if (!cats.length) return;

    const boite = (evt.currentTarget as SVGElement).getBoundingClientRect();
    const x = evt.clientX - boite.left;

    // Le point le plus proche, pas celui qu'on a touché : la zone sensible
    // couvre ainsi toute la largeur, sans viser un marqueur de 9 pixels.
    let plusProche = 0;
    let distance = Infinity;
    for (let i = 0; i < cats.length; i++) {
      const d = Math.abs(this.xDe(i) - x);
      if (d < distance) { distance = d; plusProche = i; }
    }

    this.indexActif.set(plusProche);
    const traces = this.traces();
    this.infobulle.set({
      visible: true,
      x: this.xDe(plusProche),
      y: Math.min(...traces.map((t) => t.points[plusProche].y)),
      title: cats[plusProche],
      rows: traces.map((t) => ({
        name: t.nom,
        value: formatFull(t.points[plusProche].v, this.decimales) + (this.unite ? ' ' + this.unite : ''),
        color: t.couleur,
      })),
    });
  }

  quitte(): void {
    this.indexActif.set(null);
    this.infobulle.set(TOOLTIP_HIDDEN);
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
