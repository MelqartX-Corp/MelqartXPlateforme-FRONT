// ═══════════════════════════════════════════════════════════════════════
// SOCLE COMMUN DES GRAPHIQUES
//
// Un seul vocabulaire pour tous les tableaux de bord : une série porte un
// nom, des valeurs et, éventuellement, une couleur imposée. Tout le reste —
// échelles, graduations, survol — est l'affaire des composants.
// ═══════════════════════════════════════════════════════════════════════

/** Une série de valeurs alignée sur les catégories du graphique. */
export interface ChartSeries {
  name: string;
  values: number[];
  /**
   * Couleur imposée. À laisser vide dans le cas courant : le composant
   * attribue alors la teinte de série correspondant au rang, ce qui garantit
   * qu'une même série garde sa couleur d'un graphique à l'autre.
   *
   * À ne renseigner que lorsque la couleur porte un sens — un état, pas une
   * identité : `var(--success)` pour « résolu », `var(--destructive)` pour
   * « en retard ».
   */
  color?: string;
  /** Trait pointillé : une cible, une projection, un comparatif. */
  dashed?: boolean;
  /** Aire sous la courbe. Une seule série remplie par graphique, sinon illisible. */
  area?: boolean;
}

/** Une part : camembert, anneau, classement. */
export interface ChartSlice {
  name: string;
  value: number;
  color?: string;
  /** Repris tel quel dans l'infobulle quand la valeur brute ne suffit pas. */
  hint?: string;
}

/**
 * Les six teintes d'identité, dans l'ordre d'attribution.
 *
 * Jamais recyclées : au-delà de six séries, le graphique doit regrouper
 * plutôt que réutiliser une couleur déjà prise, faute de quoi deux séries
 * différentes deviennent indiscernables.
 */
export const SERIES_COLORS: readonly string[] = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
];

/** Les couleurs d'état — réservées, jamais utilisées comme identité de série. */
export const STATUS_COLORS = {
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  neutral: 'hsl(var(--muted-foreground))',
} as const;

/** La teinte du rang `i`, en repliant au-delà de six sur la couleur neutre. */
export function seriesColor(i: number, explicite?: string): string {
  if (explicite) return explicite;
  return i < SERIES_COLORS.length ? SERIES_COLORS[i] : STATUS_COLORS.neutral;
}

/**
 * Une échelle « jolie » : des graduations sur des nombres ronds.
 *
 * Un axe qui monte à 8 237 se lit moins bien qu'un axe qui monte à 9 000 —
 * et l'œil compare des hauteurs, pas des maxima exacts.
 */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!isFinite(max) || max <= 0) return { max: 1, step: 1 };
  const brut = max / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(brut)));
  const normalise = brut / magnitude;
  const arrondi = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
  const step = arrondi * magnitude;
  return { max: step * ticks, step };
}

/** Graduations d'un axe, de 0 au maximum inclus. */
export function axisTicks(max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/**
 * Formatage compact des grands nombres : 12 400 → « 12,4 k ».
 *
 * Les axes et les tuiles n'ont pas la place d'un nombre complet, et l'ordre
 * de grandeur est ce qu'on y cherche. Le détail exact reste dans l'infobulle.
 */
export function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return trim(v / 1_000_000) + ' M';
  if (abs >= 1_000) return trim(v / 1_000) + ' k';
  return trim(v);
}

/** Nombre complet, séparateurs français — pour les infobulles et les tuiles. */
export function formatFull(v: number, decimales = 0): string {
  return v.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function trim(v: number): string {
  const arrondi = Math.round(v * 10) / 10;
  return Number.isInteger(arrondi)
    ? String(arrondi)
    : arrondi.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Un point d'infobulle : ce que le composant remonte au survol. */
export interface TooltipRow {
  name: string;
  value: string;
  color: string;
}

export interface TooltipState {
  visible: boolean;
  /** Coordonnées en pixels dans le repère du composant hôte. */
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

export const TOOLTIP_HIDDEN: TooltipState = { visible: false, x: 0, y: 0, title: '', rows: [] };
