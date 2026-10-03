import {
  Component,
  Input,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartTooltipComponent } from './chart-tooltip.component';
import {
  ChartSlice,
  TooltipState,
  TOOLTIP_HIDDEN,
  seriesColor,
  formatFull,
} from './chart.models';

interface Arc {
  chemin: string;
  couleur: string;
  nom: string;
  valeur: number;
  part: number;
  hint?: string;
}

/**
 * Anneau de répartition, avec total au centre et légende chiffrée.
 *
 * Réservé aux répartitions d'un tout en peu de parts. Au-delà de six ou sept,
 * les secteurs deviennent des échardes qu'on ne peut plus comparer : un
 * classement en barres horizontales dit alors la même chose, en lisible.
 */
@Component({
  selector: 'app-chart-donut',
  standalone: true,
  imports: [CommonModule, ChartTooltipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-agencement">
      <div class="donut-figure">
        <svg [attr.width]="taille" [attr.height]="taille"
             role="img" [attr.aria-label]="resumeAccessible()">
          <!-- Piste de fond : sans elle, un anneau presque vide n'a plus de
               forme et le total central paraît flotter. -->
          <circle [attr.cx]="centre" [attr.cy]="centre" [attr.r]="(rayon + rayonInterne) / 2"
                  fill="none" stroke="hsl(var(--muted))"
                  [attr.stroke-width]="rayon - rayonInterne" opacity="0.5" />

          <path *ngFor="let a of arcs(); let i = index"
                [attr.d]="a.chemin" [attr.fill]="a.couleur"
                class="donut-arc"
                [class.donut-arc--attenue]="indexActif() !== null && indexActif() !== i"
                (mouseenter)="survol(a, i)" (mouseleave)="quitte()" />

          <text [attr.x]="centre" [attr.y]="centre - 2"
                text-anchor="middle" class="donut-total">{{ totalAffiche() }}</text>
          <text [attr.x]="centre" [attr.y]="centre + 14"
                text-anchor="middle" class="donut-sous-titre">{{ libelleTotal }}</text>
        </svg>
        <app-chart-tooltip [etat]="infobulle()" />
      </div>

      <!-- La légende porte la valeur : lire un secteur ne doit pas obliger à
           le survoler, et le survol n'existe pas au clavier ni à l'impression. -->
      <ul class="donut-legende">
        <li *ngFor="let a of arcs(); let i = index"
            class="donut-legende__item"
            [class.donut-legende__item--attenue]="indexActif() !== null && indexActif() !== i"
            (mouseenter)="survol(a, i)" (mouseleave)="quitte()">
          <span class="donut-legende__puce" [style.background]="a.couleur"></span>
          <span class="donut-legende__nom">{{ a.nom }}</span>
          <span class="donut-legende__valeur">{{ formatFull(a.valeur) }}</span>
          <span class="donut-legende__part">{{ a.part }}%</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .donut-agencement {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    }
    .donut-figure { position: relative; flex-shrink: 0; }
    svg { display: block; }
    .donut-arc {
      transition: opacity 0.18s ease;
      cursor: default;
      /* Un liseré à la couleur de la carte sépare deux secteurs voisins —
         le « blanc » de 2 px qui empêche deux teintes de fusionner. */
      stroke: hsl(var(--card));
      stroke-width: 2;
    }
    .donut-arc--attenue { opacity: 0.3; }
    .donut-total {
      font-size: 20px; font-weight: 800; fill: hsl(var(--foreground));
      font-family: 'Outfit', sans-serif; font-variant-numeric: tabular-nums;
    }
    .donut-sous-titre {
      font-size: 10px; font-weight: 600; fill: hsl(var(--muted-foreground));
    }
    .donut-legende {
      list-style: none; margin: 0; padding: 0;
      flex: 1 1 10rem; min-width: 9rem;
      display: flex; flex-direction: column; gap: 0.3rem;
    }
    .donut-legende__item {
      display: flex; align-items: center; gap: 0.45rem;
      font-size: 11px; transition: opacity 0.18s ease;
    }
    .donut-legende__item--attenue { opacity: 0.42; }
    .donut-legende__puce { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
    .donut-legende__nom {
      color: hsl(var(--muted-foreground)); font-weight: 600;
      margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .donut-legende__valeur {
      font-weight: 700; color: hsl(var(--foreground)); font-variant-numeric: tabular-nums;
    }
    .donut-legende__part {
      color: hsl(var(--muted-foreground)); font-variant-numeric: tabular-nums;
      min-width: 2.4rem; text-align: right;
    }
  `],
})
export class ChartDonutComponent {
  @Input({ required: true }) set slices(v: ChartSlice[]) { this._slices.set(v ?? []); }
  @Input() taille = 168;
  @Input() libelleTotal = 'total';
  @Input() unite = '';

  private readonly _slices = signal<ChartSlice[]>([]);
  readonly indexActif = signal<number | null>(null);
  readonly infobulle = signal<TooltipState>(TOOLTIP_HIDDEN);

  protected readonly formatFull = formatFull;

  get centre(): number { return this.taille / 2; }
  get rayon(): number { return this.taille / 2 - 4; }
  get rayonInterne(): number { return this.rayon * 0.62; }

  private readonly total = computed(() =>
    this._slices().reduce((s, d) => s + (d.value || 0), 0));

  readonly totalAffiche = computed(() => formatFull(this.total()));

  readonly arcs = computed<Arc[]>(() => {
    const parts = this._slices().filter((d) => (d.value || 0) > 0);
    const total = this.total();
    if (!parts.length || total <= 0) return [];

    const cx = this.centre, cy = this.centre;
    const R = this.rayon, r = this.rayonInterne;
    // Départ à midi : c'est là que l'œil commence à lire un cadran.
    let angle = -Math.PI / 2;

    return parts.map((d, i) => {
      const balayage = (d.value / total) * 2 * Math.PI;
      const fin = angle + balayage;
      const grand = balayage > Math.PI ? 1 : 0;

      // Le cas d'une part unique : un arc de 360° a ses deux extrémités au
      // même point et ne dessine rien. Deux demi-cercles règlent le cas.
      const chemin = balayage >= 2 * Math.PI - 1e-6
        ? `M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx} ${cy + R} A${R} ${R} 0 1 1 ${cx} ${cy - R} Z ` +
          `M${cx} ${cy - r} A${r} ${r} 0 1 0 ${cx} ${cy + r} A${r} ${r} 0 1 0 ${cx} ${cy - r} Z`
        : `M${pt(cx, R, angle)} ${pt(cy, R, angle, true)} ` +
          `A${R} ${R} 0 ${grand} 1 ${pt(cx, R, fin)} ${pt(cy, R, fin, true)} ` +
          `L${pt(cx, r, fin)} ${pt(cy, r, fin, true)} ` +
          `A${r} ${r} 0 ${grand} 0 ${pt(cx, r, angle)} ${pt(cy, r, angle, true)} Z`;

      angle = fin;
      return {
        chemin,
        couleur: seriesColor(i, d.color),
        nom: d.name,
        valeur: d.value,
        part: Math.round((d.value / total) * 100),
        hint: d.hint,
      };
    });
  });

  readonly resumeAccessible = computed(() => {
    const parts = this.arcs().map((a) => `${a.nom} ${a.part}%`).join(', ');
    return parts ? `Répartition : ${parts}` : 'Répartition sans données';
  });

  survol(a: Arc, i: number): void {
    this.indexActif.set(i);
    this.infobulle.set({
      visible: true,
      x: this.centre,
      y: this.centre - this.rayon + 6,
      title: a.nom,
      rows: [{
        name: a.hint ?? 'Part',
        value: `${formatFull(a.valeur)}${this.unite ? ' ' + this.unite : ''} · ${a.part}%`,
        color: a.couleur,
      }],
    });
  }

  quitte(): void {
    this.indexActif.set(null);
    this.infobulle.set(TOOLTIP_HIDDEN);
  }
}

/** Coordonnée d'un point du cercle — `y` quand `estY`, `x` sinon. */
function pt(centre: number, rayon: number, angle: number, estY = false): string {
  const v = estY ? centre + rayon * Math.sin(angle) : centre + rayon * Math.cos(angle);
  return String(Math.round(v * 100) / 100);
}
