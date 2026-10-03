import { Component, Input, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartSlice, seriesColor, formatFull } from './chart.models';

interface Rang {
  nom: string;
  valeur: number;
  affichee: string;
  pourcent: number;
  couleur: string;
  hint?: string;
}

/**
 * Classement en barres horizontales.
 *
 * La forme qui remplace un camembert dès qu'il y a plus de six parts, ou que
 * les catégories portent des noms longs : ici le libellé se lit à
 * l'horizontale, et l'ordre des barres fait le tri à la place du lecteur.
 *
 * Chaque barre porte sa valeur en clair. Pas d'axe, pas d'infobulle : tout
 * ce qu'il y a à savoir est déjà écrit.
 */
@Component({
  selector: 'app-chart-ranking',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="rang-liste">
      <li class="rang" *ngFor="let r of rangs()">
        <div class="rang-entete">
          <span class="rang-puce" [style.background]="r.couleur"></span>
          <span class="rang-nom" [title]="r.nom">{{ r.nom }}</span>
          <span class="rang-valeur">{{ r.affichee }}</span>
        </div>
        <div class="rang-piste">
          <div class="rang-barre" [style.width.%]="r.pourcent" [style.background]="r.couleur"></div>
        </div>
        <p class="rang-hint" *ngIf="r.hint">{{ r.hint }}</p>
      </li>
    </ul>
    <p class="rang-vide" *ngIf="!rangs().length">Aucune donnée sur la période.</p>
  `,
  styles: [`
    :host { display: block; }
    .rang-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
    .rang-entete { display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.3rem; }
    .rang-puce { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
    .rang-nom {
      font-size: 11px; font-weight: 600; color: hsl(var(--foreground));
      margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rang-valeur {
      font-size: 11px; font-weight: 700; color: hsl(var(--foreground));
      font-variant-numeric: tabular-nums; flex-shrink: 0;
    }
    .rang-piste {
      height: 7px; border-radius: 999px; background: hsl(var(--muted)); overflow: hidden;
    }
    .rang-barre {
      height: 100%; border-radius: 999px;
      transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      min-width: 3px;
    }
    .rang-hint {
      font-size: 10px; color: hsl(var(--muted-foreground)); margin-top: 0.25rem;
    }
    .rang-vide { font-size: 11px; color: hsl(var(--muted-foreground)); padding: 0.75rem 0; }
  `],
})
export class ChartRankingComponent {
  @Input({ required: true }) set slices(v: ChartSlice[]) { this._slices.set(v ?? []); }
  /** Les n premiers seulement. 0 pour tout afficher. */
  @Input() limite = 0;
  @Input() unite = '';
  @Input() decimales = 0;
  /** Trier par valeur décroissante. À couper quand l'ordre porte un sens (une échelle de priorité). */
  @Input() trier = true;

  private readonly _slices = signal<ChartSlice[]>([]);

  readonly rangs = computed<Rang[]>(() => {
    let parts = this._slices().filter((d) => d.value !== null && d.value !== undefined);
    if (this.trier) parts = [...parts].sort((a, b) => b.value - a.value);
    if (this.limite > 0) parts = parts.slice(0, this.limite);

    // Proportionnel au plus grand, pas au total : sur un classement, ce qu'on
    // compare est le rapport entre les lignes, pas leur poids dans un tout.
    const max = Math.max(...parts.map((d) => d.value), 0);

    return parts.map((d, i) => ({
      nom: d.name,
      valeur: d.value,
      affichee: formatFull(d.value, this.decimales) + (this.unite ? ' ' + this.unite : ''),
      pourcent: max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0) : 0,
      couleur: seriesColor(i, d.color),
      hint: d.hint,
    }));
  });
}
