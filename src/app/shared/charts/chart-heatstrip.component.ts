import { Component, Input, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatFull } from './chart.models';

interface Cellule { libelle: string; valeur: number; intensite: number; titre: string; }

/**
 * Bande de densité — une valeur par tranche horaire, en intensité.
 *
 * Une seule teinte, du clair au foncé : la couleur code ici une magnitude,
 * pas une identité. Un dégradé arc-en-ciel donnerait à croire que le vert et
 * le rouge désignent deux choses différentes, alors qu'ils ne mesurent que
 * « peu » et « beaucoup ».
 */
@Component({
  selector: 'app-chart-heatstrip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bande">
      <div class="bande-cellule" *ngFor="let c of cellules()"
           [style.background]="fond(c.intensite)"
           [title]="c.titre"
           role="img" [attr.aria-label]="c.titre">
      </div>
    </div>
    <div class="bande-axe">
      <span *ngFor="let e of reperes()">{{ e }}</span>
    </div>
    <!-- L'échelle : sans elle, une intensité ne se rapporte à rien. -->
    <div class="bande-echelle">
      <span class="bande-echelle__texte">0</span>
      <span class="bande-echelle__degrade"></span>
      <span class="bande-echelle__texte">{{ maxAffiche() }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bande { display: flex; gap: 2px; }
    .bande-cellule {
      flex: 1 1 0; height: 34px; border-radius: 3px; min-width: 0;
      transition: transform 0.15s ease;
    }
    .bande-cellule:hover { transform: scaleY(1.12); }
    .bande-axe {
      display: flex; justify-content: space-between;
      margin-top: 0.3rem; font-size: 9px; color: hsl(var(--muted-foreground));
      font-variant-numeric: tabular-nums;
    }
    .bande-echelle {
      display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem;
    }
    .bande-echelle__degrade {
      flex: 1 1 auto; height: 6px; border-radius: 999px;
      background: linear-gradient(90deg,
        color-mix(in srgb, var(--series-1) 10%, hsl(var(--muted))),
        var(--series-1));
    }
    .bande-echelle__texte {
      font-size: 9px; color: hsl(var(--muted-foreground));
      font-variant-numeric: tabular-nums;
    }
  `],
})
export class ChartHeatstripComponent {
  @Input({ required: true }) set valeurs(v: number[]) { this._valeurs.set(v ?? []); }
  /** Libellés de chaque case — sert l'infobulle native et le lecteur d'écran. */
  @Input() set libelles(v: string[]) { this._libelles.set(v ?? []); }
  @Input() unite = '';

  private readonly _valeurs = signal<number[]>([]);
  private readonly _libelles = signal<string[]>([]);

  private readonly max = computed(() => Math.max(...this._valeurs(), 0));
  readonly maxAffiche = computed(() => formatFull(this.max()));

  readonly cellules = computed<Cellule[]>(() => {
    const vals = this._valeurs();
    const libs = this._libelles();
    const max = this.max();
    return vals.map((v, i) => {
      const libelle = libs[i] ?? String(i);
      return {
        libelle,
        valeur: v,
        intensite: max > 0 ? v / max : 0,
        titre: `${libelle} — ${formatFull(v)}${this.unite ? ' ' + this.unite : ''}`,
      };
    });
  });

  /** Quatre repères suffisent à situer la bande sans l'encombrer. */
  readonly reperes = computed(() => {
    const libs = this._libelles();
    if (libs.length < 4) return libs;
    const pas = Math.floor(libs.length / 4);
    return [libs[0], libs[pas], libs[pas * 2], libs[pas * 3], libs[libs.length - 1]];
  });

  /**
   * Un mélange vers le fond « discret » plutôt qu'une simple opacité : une
   * case translucide laisserait passer ce qu'il y a derrière et changerait
   * de teinte selon le fond de la carte.
   */
  fond(intensite: number): string {
    const pourcent = Math.round(10 + intensite * 90);
    return `color-mix(in srgb, var(--series-1) ${pourcent}%, hsl(var(--muted)))`;
  }
}
