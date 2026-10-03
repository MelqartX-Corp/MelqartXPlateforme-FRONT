import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { GerberFileService, UnzippedFile } from '../../services/pcb/gerber-file.service';
import { GerberProcessingService } from '../../services/pcb/gerber-processing.service';
import { Pcb3DRendererService } from '../../services/pcb/pcb-3d-renderer.service';
import { PcbDocument, PcbLayer, SolderMaskColor, PcbDefectMarker } from '../../models/pcb.models';

@Component({
  selector: 'app-pcb-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pcb-viewer.component.html',
  styleUrls: ['./pcb-viewer.component.scss']
})
export class PcbViewerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() fileOrBlob?: File | Blob;
  @Input() fileUrl?: string;
  @Input() title: string = 'Visualiseur PCB Interactif';
  @Input() height: string = '600px';
  @Input() showHeader: boolean = true;
  @Input() allowFullscreen: boolean = true;
  /** Défauts DFM/DRC à superposer sur le rendu 2D et 3D */
  @Input() defectMarkers: PcbDefectMarker[] = [];
  /** Marqueur actuellement sélectionné dans le panneau latéral */
  @Input() activeMarkerId: string | number | null = null;

  @Output() pcbLoaded = new EventEmitter<PcbDocument>();
  @Output() markerClick = new EventEmitter<PcbDefectMarker>();

  @ViewChild('threeCanvasContainer', { static: false }) threeCanvasContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('containerWrapper', { static: false }) containerWrapper!: ElementRef<HTMLDivElement>;
  @ViewChild('svgViewport', { static: false }) svgViewport!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private fileSvc = inject(GerberFileService);
  private procSvc = inject(GerberProcessingService);
  private pcb3dSvc = inject(Pcb3DRendererService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  activeTab: '2D' | '3D' | 'LAYERS' = '2D';
  activeSide: 'TOP' | 'BOTTOM' = 'TOP';
  selectedColor: SolderMaskColor = 'GREEN';

  solderMaskColors: { id: SolderMaskColor; label: string; hex: string }[] = [
    { id: 'GREEN', label: 'Vert JLCPCB', hex: '#165b2d' },
    { id: 'BLACK', label: 'Noir Mat', hex: '#18181b' },
    { id: 'BLUE', label: 'Bleu Roi', hex: '#0c4a6e' },
    { id: 'RED', label: 'Rouge Rubis', hex: '#7f1d1d' },
    { id: 'YELLOW', label: 'Jaune', hex: '#713f12' },
    { id: 'WHITE', label: 'Blanc', hex: '#e2e8f0' }
  ];

  pcbDoc: PcbDocument | null = null;
  cachedUnzippedFiles: UnzippedFile[] = [];
  isLoading = false;
  hasError = false;
  errorMessage = '';
  isFullscreen = false;

  detectedLayers: PcbLayer[] = [];
  /** Les calques CAO se génèrent à l'ouverture de l'onglet — on le dit. */
  layersLoading = false;

  // --- Pan & Zoom 2D ---
  zoom = 1;
  panX = 0;
  panY = 0;
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;

  ngOnInit(): void {
    this.loadPcbData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['fileOrBlob'] || changes['fileUrl']) && !changes['fileOrBlob']?.firstChange) {
      this.loadPcbData();
    }

    // Les défauts arrivent de façon asynchrone (polling DFM) : si la vue 3D est
    // déjà affichée, il faut y réinjecter les marqueurs sans tout re-rendre.
    if (changes['defectMarkers'] && !changes['defectMarkers'].firstChange) {
      if (this.activeTab === '3D' && this.pcbDoc) {
        this.pcb3dSvc.renderDefectMarkers(this.defectMarkers, this.pcbDoc.metadata);
      }
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.pcb3dSvc.destroy();
  }

  async loadPcbData(): Promise<void> {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      let blob: Blob;

      if (this.fileOrBlob) {
        blob = this.fileOrBlob;
      } else if (this.fileUrl) {
        try {
          blob = await firstValueFrom(this.http.get(this.fileUrl, { responseType: 'blob' }));
        } catch (httpErr) {
          const res = await fetch(this.fileUrl);
          if (!res.ok) throw new Error(`Erreur de téléchargement (${res.status} ${res.statusText})`);
          blob = await res.blob();
        }
      } else {
        throw new Error('Aucun fichier ou URL fourni.');
      }

      // 1. Dézippage sécurisé des fichiers Gerber
      this.cachedUnzippedFiles = await this.fileSvc.extractZip(blob);

      // 2. Traitement stackup complet via pcb-stackup (vrai compositing solder mask)
      this.pcbDoc = await this.procSvc.processGerberFiles(
        this.cachedUnzippedFiles,
        1.6,
        this.selectedColor
      );

      this.detectedLayers = this.pcbDoc.layers;
      this.pcbLoaded.emit(this.pcbDoc);
      this.isLoading = false;
      this.reset2DView();
      this.cdr.detectChanges();

      if (this.activeTab === '3D') {
        setTimeout(() => this.init3D(), 50);
      }

    } catch (err: any) {
      this.isLoading = false;
      this.hasError = true;
      this.errorMessage = err.message || 'Erreur lors du traitement du fichier Gerber.';
      this.cdr.detectChanges();
    }
  }

  get currentSvgContent(): SafeHtml {
    if (!this.pcbDoc) return '';
    const rawSvg = this.activeSide === 'TOP' ? this.pcbDoc.topSvg : this.pcbDoc.bottomSvg;
    if (!rawSvg) return '';
    return this.sanitizer.bypassSecurityTrustHtml(this.withDefectMarkers(rawSvg));
  }

  // ── Superposition des défauts DFM sur le SVG 2D ────────────────

  /** Le viewBox du stackup, découpé en [minX, minY, width, height]. */
  get viewBoxParts(): number[] | null {
    const box = this.pcbDoc?.masterBox || this.pcbDoc?.metadata?.masterBox;
    if (!box) return null;
    const parts = box.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
    return parts;
  }

  /**
   * Convertit une position en mm (repère Gerber) vers les unités du viewBox SVG.
   * L'axe Y est inversé : en Gerber il monte, en SVG il descend.
   */
  markerPosition(marker: PcbDefectMarker): { cx: number; cy: number } | null {
    const meta = this.pcbDoc?.metadata;
    const box = this.viewBoxParts;
    if (!meta || !box || !meta.widthMm) return null;
    if (!Number.isFinite(marker.xMm) || !Number.isFinite(marker.yMm)) return null;

    const unitsPerMm = box[2] / meta.widthMm;
    const cx = (marker.xMm - meta.minXMm) * unitsPerMm + box[0];
    const cy = (meta.minYMm + meta.heightMm - marker.yMm) * unitsPerMm + box[1];
    return { cx, cy };
  }

  /** Rayon du marqueur, proportionnel à la carte pour rester lisible à tout zoom. */
  markerRadius(): number {
    const box = this.viewBoxParts;
    return box ? box[2] * 0.006 : 5;
  }

  markerColor(severity: string): string {
    switch (severity) {
      case 'HIGH': return '#ef4444';   // rouge
      case 'MEDIUM': return '#f97316'; // orange
      default: return '#3b82f6';       // bleu
    }
  }

  /**
   * Injecte les marqueurs directement dans le SVG, juste avant </svg>, afin
   * qu'ils héritent du viewBox et suivent parfaitement le pan / zoom.
   */
  private withDefectMarkers(rawSvg: string): string {
    if (!this.defectMarkers?.length) return rawSvg;

    const closing = rawSvg.lastIndexOf('</svg>');
    if (closing === -1) return rawSvg;

    const r = this.markerRadius();
    const visible = this.defectMarkers.filter(
      m => !m.side || m.side === this.activeSide
    );

    let overlay = '';
    for (const marker of visible) {
      const pos = this.markerPosition(marker);
      if (!pos) continue;

      const color = this.markerColor(marker.severity);
      const isActive = this.activeMarkerId != null && this.activeMarkerId === marker.id;
      const outerR = isActive ? r * 2.6 : r * 2;

      overlay +=
        `<g class="pcb-defect-marker" data-marker-id="${this.escapeXml(String(marker.id))}" style="cursor:pointer">` +
        `<title>${this.escapeXml(marker.label)}</title>` +
        `<circle cx="${pos.cx}" cy="${pos.cy}" r="${outerR}" fill="none" ` +
        `stroke="${color}" stroke-width="${r * 0.45}" opacity="0.85">` +
        `<animate attributeName="r" values="${outerR};${outerR * 1.45};${outerR}" ` +
        `dur="1.6s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0.85;0.25;0.85" ` +
        `dur="1.6s" repeatCount="indefinite"/>` +
        `</circle>` +
        `<circle cx="${pos.cx}" cy="${pos.cy}" r="${r}" fill="${color}" ` +
        `stroke="#ffffff" stroke-width="${r * 0.3}"/>` +
        `</g>`;
    }

    if (!overlay) return rawSvg;
    return rawSvg.slice(0, closing) + overlay + rawSvg.slice(closing);
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /** Délégation d'événement : le SVG est injecté via innerHTML, pas de binding Angular. */
  onSvgContainerClick(event: MouseEvent): void {
    if (!this.defectMarkers?.length) return;
    const target = event.target as Element | null;
    const group = target?.closest?.('[data-marker-id]');
    if (!group) return;

    const id = group.getAttribute('data-marker-id');
    const marker = this.defectMarkers.find(m => String(m.id) === id);
    if (marker) {
      event.stopPropagation();
      this.markerClick.emit(marker);
    }
  }

  getSafeSvg(svg?: string): SafeHtml {
    if (!svg) return '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  toggleAllLayers(visible: boolean): void {
    for (const l of this.detectedLayers) {
      l.visible = visible;
    }
  }

  get currentSideDimensions(): string {
    if (!this.pcbDoc) return '';
    return `${this.pcbDoc.metadata.widthMm} mm × ${this.pcbDoc.metadata.heightMm} mm`;
  }

  setTab(tab: '2D' | '3D' | 'LAYERS'): void {
    this.activeTab = tab;
    if (tab === '3D') {
      setTimeout(() => this.init3D(), 50);
    } else if (tab === 'LAYERS') {
      // Les SVG des calques ne sont produits qu'ici, et une seule fois : les
      // générer au chargement ajoutait autant de rendus que de fichiers dans
      // l'archive, avant même le premier affichage de la carte — pour un
      // onglet que la plupart des visiteurs n'ouvrent jamais.
      this.preparerCalques();
    } else if (tab === '2D') {
      this.cdr.detectChanges();
    }
  }

  /** Génère les calques CAO au premier affichage de l'onglet. */
  private preparerCalques(): void {
    if (!this.pcbDoc || this.pcbDoc.cadLayersRendered) {
      this.cdr.detectChanges();
      return;
    }
    this.layersLoading = true;
    this.cdr.detectChanges();

    // Un tick avant de calculer : sans lui, le navigateur peint l'indicateur
    // en même temps qu'il se fige, c'est-à-dire jamais.
    setTimeout(() => {
      this.pcbDoc = this.procSvc.renderCadLayers(this.pcbDoc!);
      this.detectedLayers = this.pcbDoc.layers;
      this.layersLoading = false;
      this.cdr.detectChanges();
    }, 20);
  }

  setSide(side: 'TOP' | 'BOTTOM'): void {
    this.activeSide = side;
    this.cdr.detectChanges();
  }

  async setColor(color: SolderMaskColor): Promise<void> {
    this.selectedColor = color;
    if (this.pcbDoc) {
      this.pcbDoc.metadata.solderMaskColor = color;
    }
    this.pcb3dSvc.updateColor(color);

    // Recomposer le stackup avec la nouvelle couleur.
    //
    // Sans relire un seul Gerber : le vernis est une affaire de compositing,
    // le cuivre et la sérigraphie ne changent pas. Repasser par l'analyse
    // figeait l'écran plusieurs secondes à chaque clic sur une pastille de
    // couleur, pour recalculer une géométrie identique.
    if (this.pcbDoc?.stackupLayers?.length) {
      try {
        this.pcbDoc = await this.procSvc.restackWithColor(this.pcbDoc, this.selectedColor);
        this.detectedLayers = this.pcbDoc.layers;
        this.cdr.detectChanges();
      } catch (e) {
        console.warn('Erreur mise à jour couleur:', e);
      }
    }
  }

  toggleLayerVisibility(layer: PcbLayer): void {
    layer.visible = !layer.visible;
  }

  getLayerZIndex(layer: PcbLayer): number {
    if (layer.kind === 'SILK' && layer.side === 'BOTTOM') return 10;
    if (layer.kind === 'PASTE' && layer.side === 'BOTTOM') return 11;
    if (layer.kind === 'MASK' && layer.side === 'BOTTOM') return 12;
    if (layer.kind === 'COPPER' && layer.side === 'BOTTOM') return 13;
    if (layer.kind === 'COPPER' && layer.side === 'TOP') return 14;
    if (layer.kind === 'MASK' && layer.side === 'TOP') return 15;
    if (layer.kind === 'PASTE' && layer.side === 'TOP') return 16;
    if (layer.kind === 'SILK' && layer.side === 'TOP') return 17;
    if (layer.kind === 'OUTLINE') return 18;
    if (layer.kind === 'DRILL') return 19;
    return 20;
  }

  async init3D(): Promise<void> {
    if (!this.threeCanvasContainer || !this.pcbDoc) return;
    // three.js arrive ici, au premier passage en 3D : l'attendre est
    // indispensable, tout ce qui suit s'en sert.
    await this.pcb3dSvc.init(this.threeCanvasContainer.nativeElement);
    // Les marqueurs doivent être ajoutés APRÈS la carte : le rendu recrée le groupe.
    await this.pcb3dSvc.renderPcb(this.pcbDoc, this.selectedColor);
    this.pcb3dSvc.renderDefectMarkers(this.defectMarkers, this.pcbDoc.metadata);
  }

  reset2DView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    if (this.activeTab === '3D') {
      this.pcb3dSvc.resetView();
    }
  }

  zoomIn(): void {
    this.zoom = Math.min(this.zoom * 1.25, 10);
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom / 1.25, 0.2);
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    this.zoom = Math.max(0.2, Math.min(10, this.zoom * factor));
  }

  onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.dragStartX = e.clientX - this.panX;
    this.dragStartY = e.clientY - this.panY;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.panX = e.clientX - this.dragStartX;
    this.panY = e.clientY - this.dragStartY;
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  toggleFullscreen(): void {
    if (!this.containerWrapper) return;
    const elem = this.containerWrapper.nativeElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => this.isFullscreen = true);
    } else {
      document.exitFullscreen().then(() => this.isFullscreen = false);
    }
  }
}
