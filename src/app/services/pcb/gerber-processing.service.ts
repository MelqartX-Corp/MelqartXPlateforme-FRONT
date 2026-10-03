import { Injectable } from '@angular/core';
import pcbStackup, { StackupResult, StackupColorOptions } from 'pcb-stackup';
// @ts-ignore
import render from 'gerber-to-svg/render.js';
// @ts-ignore
import xmlElementString from 'xml-element-string';
import { UnzippedFile } from './gerber-file.service';
import {
  PcbDocument,
  PcbLayer,
  LayerKind,
  LayerSide,
  SolderMaskColor,
  PcbMetadata
} from '../../models/pcb.models';

@Injectable({
  providedIn: 'root'
})
export class GerberProcessingService {

  /**
   * Parse le Gerber et compose le rendu realiste.
   *
   * L'analyse est de loin l'etape la plus lourde : chaque fichier est lu
   * trait par trait pour en tirer une geometrie. Elle n'est donc faite qu'une
   * fois — les converters produits sont conserves sur le document, et tout ce
   * qui vient ensuite (changer la couleur du vernis, ouvrir les calques CAO)
   * les reutilise au lieu de tout relire.
   *
   * Les SVG des calques individuels ne sont pas generes ici. Ils ne servent
   * qu'a l'onglet « Layers », que la plupart des visiteurs n'ouvrent jamais,
   * et les produire d'avance ajoutait autant de rendus SVG que de fichiers
   * dans l'archive — sur le chemin critique, avant le premier affichage.
   */
  async processGerberFiles(
    files: UnzippedFile[],
    customThickness: number = 1.6,
    solderMaskColor: SolderMaskColor = 'GREEN'
  ): Promise<PcbDocument> {
    const validFiles = files.filter(f => {
      const name = f.filename.toLowerCase();
      return !name.endsWith('.gbrjob') && !name.endsWith('.pdf') && !name.endsWith('.png');
    });

    const stackupLayers = validFiles.map(f => ({
      gerber: f.content,
      filename: f.filename.split('/').pop() || f.filename
    }));

    const stackupResult = await this.stack(stackupLayers, solderMaskColor);
    return this.toDocument(stackupResult, customThickness, solderMaskColor);
  }

  /**
   * Recompose la carte dans une autre couleur, sans relire un seul Gerber.
   *
   * Le vernis est une affaire de compositing : le cuivre, la serigraphie et
   * les percages sont les memes. Repasser par l'analyse pour changer une
   * teinte, c'etait payer plusieurs secondes pour un resultat deja calcule —
   * et l'ecran restait fige pendant ce temps, a chaque clic sur une pastille.
   */
  async restackWithColor(
    doc: PcbDocument,
    solderMaskColor: SolderMaskColor
  ): Promise<PcbDocument> {
    if (!doc.stackupLayers?.length) {
      return doc;
    }
    const stackupResult = await this.stack(doc.stackupLayers, solderMaskColor);
    const rendu = this.toDocument(stackupResult, doc.metadata.thicknessMm, solderMaskColor);

    // Les calques CAO deja generes gardent leurs couleurs de reperage : elles
    // ne dependent pas du vernis, et les refaire serait du travail pour rien.
    if (doc.cadLayersRendered) {
      rendu.layers = doc.layers;
      rendu.cadLayersRendered = true;
    }
    return rendu;
  }

  /**
   * Genere les SVG des calques individuels — a la demande, une seule fois.
   *
   * Appele quand l'onglet « Layers » s'ouvre. Tous les calques sont alignes
   * sur le meme viewBox que le composite, sans quoi ils se superposeraient
   * de travers.
   */
  renderCadLayers(doc: PcbDocument): PcbDocument {
    if (doc.cadLayersRendered || !doc.stackupLayers?.length) {
      return doc;
    }

    const box = doc.metadata.masterBox
      ? doc.metadata.masterBox.trim().split(/\s+/).map(Number)
      : [0, 0, 100, 100];

    for (const layer of doc.layers) {
      const source = doc.stackupLayers[layer.sourceIndex ?? -1];
      const converter = source?.converter;
      if (!converter) continue;

      // render() lit le viewBox du converter pour calculer le retournement
      // vertical : l'aligner sur le composite est indispensable. On remet
      // ensuite les valeurs d'origine — le converter resservira au prochain
      // changement de couleur, et une geometrie modifiee fausserait la
      // composition.
      const origine = {
        viewBox: converter.viewBox,
        width: converter.width,
        height: converter.height,
        units: converter.units
      };

      try {
        converter.viewBox = [...box];
        converter.width = box[2] / 1000;
        converter.height = box[3] / 1000;
        converter.units = doc.metadata.stackupUnits || 'in';

        layer.svgContent = render(
          converter,
          {
            color: layer.color,
            viewBox: box.join(' '),
            width: (box[2] / 1000) + (doc.metadata.stackupUnits || 'in'),
            height: (box[3] / 1000) + (doc.metadata.stackupUnits || 'in')
          },
          xmlElementString
        );
      } finally {
        converter.viewBox = origine.viewBox;
        converter.width = origine.width;
        converter.height = origine.height;
        converter.units = origine.units;
      }
    }

    doc.cadLayersRendered = true;
    return doc;
  }

  // ── Rouages ──────────────────────────────────────────────────────

  /**
   * Un passage de pcb-stackup, avec repli sans masque d'outline.
   *
   * Une couche arrivant avec son converter n'est pas relue : c'est ce qui
   * rend le changement de couleur quasi instantane.
   */
  private stack(layers: any[], solderMaskColor: SolderMaskColor): Promise<StackupResult> {
    const colorConfig = this.getColorConfig(solderMaskColor);

    return new Promise<StackupResult>((resolve, reject) => {
      pcbStackup(
        layers,
        { color: colorConfig, maskWithOutline: true, outlineGapFill: 0.00011 },
        (err, result) => {
          if (err) {
            pcbStackup(
              layers,
              { color: colorConfig, maskWithOutline: false },
              (err2, result2) => {
                if (err2) reject(err2);
                else resolve(result2);
              }
            );
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /** Le document tel que la vue le consomme, sans les SVG de calques. */
  private toDocument(
    stackupResult: StackupResult,
    customThickness: number,
    solderMaskColor: SolderMaskColor
  ): PcbDocument {
    // Dimensions reelles de la carte (mm)
    let widthMm = 80;
    let heightMm = 60;
    // Origine de la carte : le viewBox Gerber ne demarre pas forcement a
    // (0,0). Indispensable pour repositionner les defauts DFM, exprimes en
    // millimetres absolus.
    let minXMm = 0;
    let minYMm = 0;

    const units = stackupResult.top?.units || 'in';
    const factor = units === 'in' ? 25.4 : 1;

    if (stackupResult.top) {
      if (stackupResult.top.width && stackupResult.top.height) {
        widthMm = Math.round(stackupResult.top.width * factor * 100) / 100;
        heightMm = Math.round(stackupResult.top.height * factor * 100) / 100;
      }
      // Le viewBox est exprime en milliemes de l'unite du stackup
      if (stackupResult.top.viewBox) {
        minXMm = Math.round((stackupResult.top.viewBox[0] / 1000) * factor * 100) / 100;
        minYMm = Math.round((stackupResult.top.viewBox[1] / 1000) * factor * 100) / 100;
      }
    }

    const globalBox = stackupResult.top?.viewBox || [0, 0, 100, 100];
    const masterBox = globalBox.join(' ');
    const stackupLayers = stackupResult.layers || [];

    const layers: PcbLayer[] = stackupLayers.map((l: any, idx: number) => {
      const kind = this.mapLayerType(l.type);
      const side = this.mapLayerSide(l.side);
      return {
        id: `layer_${idx}_${l.type}_${l.side}`,
        filename: l.filename,
        displayName: this.getLayerDisplayName(kind, side, l.filename),
        kind,
        side,
        visible: true,
        color: this.getLayerCadColor(kind, side),
        svgContent: '',
        parsedNodeCount: l.converter?.layer?.length || 100,
        // L'index survit au tri : c'est par lui qu'on retrouve le converter.
        sourceIndex: idx
      };
    });

    // Ordre naturel JLCPCB : serigraphie -> pate -> vernis -> cuivre -> contour -> percages
    layers.sort((a, b) => this.getLayerOrderWeight(a) - this.getLayerOrderWeight(b));

    const metadata: PcbMetadata = {
      widthMm,
      heightMm,
      minXMm,
      minYMm,
      thicknessMm: customThickness,
      layerCount: layers.filter(l => l.kind === 'COPPER').length || 2,
      solderMaskColor,
      copperColor: '#deb841',
      masterBox,
      stackupUnits: units
    };

    return {
      layers,
      drills: [],
      metadata,
      masterBox,
      topSvg: stackupResult.top?.svg,
      bottomSvg: stackupResult.bottom?.svg,
      stackupLayers,
      cadLayersRendered: false
    };
  }

  private mapLayerType(type: string): LayerKind {
    switch (type) {
      case 'copper': return 'COPPER';
      case 'soldermask': return 'MASK';
      case 'silkscreen': return 'SILK';
      case 'solderpaste': return 'PASTE';
      case 'drill': return 'DRILL';
      case 'outline': return 'OUTLINE';
      default: return 'UNKNOWN';
    }
  }

  private mapLayerSide(side: string): LayerSide {
    switch (side) {
      case 'top': return 'TOP';
      case 'bottom': return 'BOTTOM';
      case 'inner': return 'INNER';
      default: return 'ALL';
    }
  }

  private getLayerDisplayName(kind: LayerKind, side: LayerSide, filename: string): string {
    const fnLower = filename.toLowerCase();
    switch (kind) {
      case 'SILK': return side === 'TOP' ? 'Top Silkscreen Layer' : 'Bottom Silkscreen Layer';
      case 'PASTE': return side === 'TOP' ? 'Top Paste Mask Layer' : 'Bottom Paste Mask Layer';
      case 'MASK': return side === 'TOP' ? 'Top Solder Mask Layer' : 'Bottom Solder Mask Layer';
      case 'COPPER': return side === 'TOP' ? 'Top Layer' : 'Bottom Layer';
      case 'OUTLINE': return 'Board Outline Layer';
      case 'DRILL':
        if (fnLower.includes('npth')) return 'drl (NPTH Drill)';
        if (fnLower.includes('pth')) return 'drl (PTH Drill)';
        return 'drl (Drill)';
      default: return filename;
    }
  }

  private getLayerCadColor(kind: LayerKind, side: LayerSide): string {
    switch (kind) {
      case 'SILK': return side === 'TOP' ? '#facc15' : '#22c55e'; // Top Silk Jaune (#facc15), Bottom Silk Vert (#22c55e)
      case 'PASTE': return '#94a3b8'; // Gris clair (#94a3b8)
      case 'MASK': return side === 'TOP' ? '#a855f7' : '#ec4899'; // Top Mask Violet (#a855f7), Bottom Mask Rose (#ec4899)
      case 'COPPER': return side === 'TOP' ? '#ef4444' : '#3b82f6'; // Top Copper Rouge (#ef4444), Bottom Copper Bleu (#3b82f6)
      case 'OUTLINE': return '#c084fc'; // Violet/Bordure (#c084fc)
      case 'DRILL': return '#f8fafc'; // Blanc (#f8fafc)
      default: return '#94a3b8';
    }
  }

  private getLayerOrderWeight(layer: PcbLayer): number {
    if (layer.kind === 'SILK' && layer.side === 'TOP') return 1;
    if (layer.kind === 'SILK' && layer.side === 'BOTTOM') return 2;
    if (layer.kind === 'PASTE' && layer.side === 'TOP') return 3;
    if (layer.kind === 'PASTE' && layer.side === 'BOTTOM') return 4;
    if (layer.kind === 'MASK' && layer.side === 'TOP') return 5;
    if (layer.kind === 'COPPER' && layer.side === 'TOP') return 6;
    if (layer.kind === 'COPPER' && layer.side === 'BOTTOM') return 7;
    if (layer.kind === 'MASK' && layer.side === 'BOTTOM') return 8;
    if (layer.kind === 'OUTLINE') return 9;
    if (layer.kind === 'DRILL') return 10;
    return 20;
  }

  private getColorConfig(color: SolderMaskColor): StackupColorOptions {
    switch (color) {
      case 'BLUE':
        return {
          fr4: '#0c4a6e',
          cu: '#deb841',
          cf: '#deb841',
          sm: 'rgba(12, 74, 110, 0.75)',
          ss: '#ffffff',
          sp: '#deb841'
        };
      case 'BLACK':
        return {
          fr4: '#18181b',
          cu: '#deb841',
          cf: '#deb841',
          sm: 'rgba(24, 24, 27, 0.85)',
          ss: '#ffffff',
          sp: '#deb841'
        };
      case 'RED':
        return {
          fr4: '#7f1d1d',
          cu: '#deb841',
          cf: '#deb841',
          sm: 'rgba(127, 29, 29, 0.75)',
          ss: '#ffffff',
          sp: '#deb841'
        };
      case 'YELLOW':
        return {
          fr4: '#713f12',
          cu: '#c97825',
          cf: '#c97825',
          sm: 'rgba(202, 138, 4, 0.75)',
          ss: '#000000',
          sp: '#c97825'
        };
      case 'WHITE':
        return {
          fr4: '#cbd5e1',
          cu: '#deb841',
          cf: '#deb841',
          sm: 'rgba(241, 245, 249, 0.88)',
          ss: '#0f172a',
          sp: '#deb841'
        };
      case 'GREEN':
      default:
        return {
          fr4: '#165b2d',
          cu: '#c89632',
          cf: '#d4af37',
          sm: 'rgba(22, 91, 45, 0.74)',
          ss: '#ffffff',
          sp: '#d4af37'
        };
    }
  }
}
