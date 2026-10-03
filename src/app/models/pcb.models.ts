// ════════════════════════════════════════════════════════════════
// PCB DOMAIN & NORMALIZED GEOMETRY MODELS
// ════════════════════════════════════════════════════════════════

export type LayerKind = 'COPPER' | 'MASK' | 'SILK' | 'PASTE' | 'DRILL' | 'OUTLINE' | 'UNKNOWN';
export type LayerSide = 'TOP' | 'BOTTOM' | 'INNER' | 'ALL';
export type SolderMaskColor = 'GREEN' | 'BLACK' | 'BLUE' | 'RED' | 'WHITE' | 'YELLOW';

export interface PcbBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
}

export interface PcbLayer {
  id: string;
  filename: string;
  displayName: string;
  kind: LayerKind;
  side: LayerSide;
  visible: boolean;
  color: string;
  svgContent?: string;
  parsedNodeCount: number;
  /**
   * Position d'origine dans le stackup.
   *
   * Les calques sont triés pour l'affichage ; cet index, lui, ne bouge pas et
   * reste le seul lien vers le converter qui a produit la couche.
   */
  sourceIndex?: number;
}

export interface PcbMetadata {
  widthMm: number;
  heightMm: number;
  thicknessMm: number; // default: 1.6 mm
  layerCount: number;
  solderMaskColor: SolderMaskColor;
  copperColor: string;
  masterBox?: string;
  /** Origine réelle de la carte en mm (coin bas-gauche du viewBox Gerber) */
  minXMm: number;
  minYMm: number;
  /** Unité du stackup ('in' ou 'mm') — les calques CAO s'alignent dessus. */
  stackupUnits?: string;
}

/**
 * Marqueur de défaut DFM/DRC à superposer sur le rendu 2D et 3D.
 * Les coordonnées sont exprimées en mm dans le repère Gerber d'origine.
 */
export interface PcbDefectMarker {
  id: string | number;
  xMm: number;
  yMm: number;
  side?: 'TOP' | 'BOTTOM';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
}

export interface PcbDocument {
  boardOutline?: any;
  layers: PcbLayer[];
  drills: any[];
  metadata: PcbMetadata;
  masterBox?: string;
  topSvg?: string;
  bottomSvg?: string;

  /**
   * Les couches telles que pcb-stackup les a rendues, converters compris.
   *
   * On les garde parce que l'analyse du Gerber est de loin l'etape la plus
   * couteuse, et qu'elle n'a aucune raison d'etre refaite : changer la
   * couleur du vernis ou ouvrir l'onglet des calques ne change pas ce qui est
   * grave sur le cuivre. pcb-stackup saute l'analyse des qu'une couche arrive
   * avec son converter.
   */
  stackupLayers?: any[];

  /** Vrai une fois les SVG de calques generes — ils le sont a la demande. */
  cadLayersRendered?: boolean;
}
