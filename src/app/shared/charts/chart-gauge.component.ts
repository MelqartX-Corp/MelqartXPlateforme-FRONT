import { Component, Input, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Jauge en arc — un pourcentage unique, lu d'un coup d'œil.
 *
 * Réservée aux taux : une jauge dit « où en est-on par rapport au plein »,
 * question qui n'a de sens que pour une part d'un tout. Un compteur (« 42
 * tickets ») n'a pas de plein et va dans une tuile chiffrée.
 *
 * La couleur suit des seuils et n'est donc pas décorative : elle porte un
 * jugement (bon / à surveiller / critique). Le pourcentage reste écrit au
 * centre — la couleur ne doit jamais être seule à dire l'état.
 */
@Component({
  selector: 'app-chart-gauge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jauge" [style.width.px]="taille">
      <svg [attr.width]="taille" [attr.height]="hauteurSvg()"
           role="img" [attr.aria-label]="libelle + ' : ' + valeurArrondie() + ' pour cent'">
        <path [attr.d]="arcFond()" fill="none" stroke="hsl(var(--muted))"
              [attr.stroke-width]="epaisseur" stroke-linecap="round" />
        <path [attr.d]="arcValeur()" fill="none" [attr.stroke]="couleur()"
              [attr.stroke-width]="epaisseur" stroke-linecap="round"
              class="jauge-arc" />
      </svg>
      <div class="jauge-centre">
        <p class="jauge-valeur">{{ valeurArrondie() }}<span class="jauge-unite">%</span></p>
        <p class="jauge-libelle">{{ libelle }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .jauge { position: relative; margin: 0 auto; }
    svg { display: block; overflow: visible; }
    .jauge-arc { transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
    .jauge-centre {
      position: absolute; left: 0; right: 0; bottom: 0;
      text-align: center; pointer-events: none;
    }
    .jauge-valeur {
      font-size: 22px; font-weight: 800; line-height: 1;
      color: hsl(var(--foreground)); font-family: 'Outfit', sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .jauge-unite { font-size: 13px; font-weight: 700; margin-left: 1px; }
    .jauge-libelle {
      font-size: 10px; font-weight: 600; color: hsl(var(--muted-foreground));
      margin-top: 0.15rem;
    }
  `],
})
export class ChartGaugeComponent {
  @Input({ required: true }) set valeur(v: number) { this._valeur.set(clamp(v ?? 0)); }
  @Input() libelle = '';
  @Input() taille = 150;
  @Input() epaisseur = 11;
  /** En dessous : critique. Au-dessus de `seuilBon` : bon. Entre les deux : à surveiller. */
  @Input() seuilAlerte = 60;
  @Input() seuilBon = 85;
  /**
   * Inverse le jugement, pour une mesure où « moins c'est mieux » — un taux
   * de retard, par exemple.
   */
  @Input() inverse = false;

  private readonly _valeur = signal(0);
  readonly valeurArrondie = computed(() => Math.round(this._valeur()));

  /**
   * L'arc descend jusqu'à sin(160°) ≈ 0,34 rayon sous le centre. Une boîte
   * calée sur la moitié du diamètre lui couperait les deux pieds — d'où ce
   * facteur, qui suit la géométrie plutôt qu'un réglage à l'œil.
   */
  readonly hauteurSvg = computed(() => Math.round(this.taille * 0.72));

  readonly couleur = computed(() => {
    const v = this.inverse ? 100 - this._valeur() : this._valeur();
    if (v >= this.seuilBon) return 'hsl(var(--success))';
    if (v >= this.seuilAlerte) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  });

  /** Un arc de 220°, ouvert vers le bas : la forme d'un cadran. */
  private readonly ANGLE_DEBUT = 160;
  private readonly ANGLE_TOTAL = 220;

  arcFond(): string {
    return this.arc(100);
  }

  arcValeur(): string {
    return this.arc(this._valeur());
  }

  private arc(pourcent: number): string {
    const r = this.taille / 2 - this.epaisseur / 2;
    const cx = this.taille / 2;
    const cy = this.taille / 2;
    const debut = this.ANGLE_DEBUT;
    const fin = debut + (this.ANGLE_TOTAL * clamp(pourcent)) / 100;

    // Un arc de longueur nulle ne dessine rien : sans ce garde-fou, une jauge
    // à 0 % laisserait un point isolé dû au `stroke-linecap` arrondi.
    if (pourcent <= 0.01) return '';

    const p1 = polaire(cx, cy, r, debut);
    const p2 = polaire(cx, cy, r, fin);
    const grand = fin - debut > 180 ? 1 : 0;
    return `M${p1.x} ${p1.y} A${r} ${r} 0 ${grand} 1 ${p2.x} ${p2.y}`;
  }
}

function polaire(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: Math.round((cx + r * Math.cos(rad)) * 100) / 100,
    y: Math.round((cy + r * Math.sin(rad)) * 100) / 100,
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
