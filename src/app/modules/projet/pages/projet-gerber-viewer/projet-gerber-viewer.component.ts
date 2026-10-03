import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../../services/projet.service';
import { AuthService } from '../../../../services';
import { Projet, DocumentProjet, DfmAnalysisResult, DfmViolation } from '../../models/projet.models';
import { PcbViewerComponent } from '../../../../components/pcb-viewer/pcb-viewer.component';
import { PcbDocument, PcbDefectMarker } from '../../../../models/pcb.models';

/** L'analyse DFM est déclenchée automatiquement à l'upload : on interroge le résultat. */
const DFM_POLL_INTERVAL_MS = 5000;
const DFM_POLL_MAX_ATTEMPTS = 36; // ≈ 3 minutes

type RGB = [number, number, number];

@Component({
  selector: 'app-projet-gerber-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PcbViewerComponent],
  templateUrl: './projet-gerber-viewer.component.html',
  styleUrls: ['./projet-gerber-viewer.component.scss']
})
export class ProjetGerberViewerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);

  loading = true;
  error = '';
  projet?: Projet;
  gerberDoc?: DocumentProjet;
  pcbData?: PcbDocument;
  userRole = 'CLIENT';
  signedUrl?: string;

  // ── État de l'analyse DFM ──
  dfm?: DfmAnalysisResult;
  dfmLoading = false;
  dfmError = '';
  activeMarkerId: string | number | null = null;
  showNavTips = false;

  private pollTimer?: ReturnType<typeof setTimeout>;
  private pollAttempts = 0;

  ngOnInit(): void {
    this.userRole = this.authSvc.role || 'CLIENT';
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Identifiant du projet manquant.';
      this.loading = false;
      return;
    }

    this.loadProjet(id);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadProjet(id: string): void {
    this.loading = true;
    this.error = '';

    this.projetSvc.getProjet(id).subscribe({
      next: (p) => {
        this.projet = p;
        this.loading = false;

        // Trouver le document Gerber
        this.gerberDoc = p.documents?.find(d =>
          d.typeDocument === 'GERBER' ||
          (d.nomDocument && (d.nomDocument.toLowerCase().endsWith('.zip') || d.nomDocument.toLowerCase().endsWith('.rar') || d.nomDocument.toLowerCase().endsWith('.7z')))
        );

        if (!this.gerberDoc) {
          this.error = "Aucun fichier d'archive Gerber (.zip) n'a encore été téléversé pour ce projet.";
        } else if (this.gerberDoc.id) {
          // Option 3 : Récupérer l'URL signée temporaire via le backend
          this.projetSvc.getDocumentAccessUrl(p.id, this.gerberDoc.id).subscribe({
            next: (res) => {
              this.signedUrl = res.url;
            },
            error: () => {
              this.signedUrl = this.gerberDoc?.fileUrl;
            }
          });
        } else {
          this.signedUrl = this.gerberDoc.fileUrl;
        }

        if (this.gerberDoc) {
          this.loadDfmResult();
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger le projet.';
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ANALYSE DFM
  // ══════════════════════════════════════════════════════════════

  loadDfmResult(): void {
    if (!this.projet) return;
    this.dfmLoading = true;
    this.dfmError = '';

    this.projetSvc.getDfmResult(this.projet.id).subscribe({
      next: (res) => {
        this.dfm = res;
        this.dfmLoading = false;

        // L'analyse tourne en asynchrone côté ms-bom : on repasse plus tard.
        if (res?.status === 'PENDING') {
          this.scheduleNextPoll();
        } else {
          this.stopPolling();
        }
      },
      error: (err) => {
        this.dfmLoading = false;
        if (err?.status === 404) {
          // Pas encore d'analyse pour ce Gerber : on patiente sans afficher d'erreur.
          this.dfm = undefined;
          this.scheduleNextPoll();
        } else {
          this.dfmError = "L'analyse DFM n'a pas pu être récupérée.";
          this.stopPolling();
        }
      }
    });
  }

  relaunchAnalysis(): void {
    if (!this.projet) return;
    this.dfmError = '';
    this.dfmLoading = true;
    this.pollAttempts = 0;

    this.projetSvc.triggerDfmAnalysis(this.projet.id).subscribe({
      next: () => {
        this.dfm = { status: 'PENDING' };
        this.dfmLoading = false;
        this.scheduleNextPoll();
      },
      error: () => {
        this.dfmLoading = false;
        this.dfmError = "Impossible de relancer l'analyse pour le moment.";
      }
    });
  }

  private scheduleNextPoll(): void {
    if (this.pollAttempts >= DFM_POLL_MAX_ATTEMPTS) {
      this.stopPolling();
      return;
    }
    this.pollAttempts++;
    this.stopPolling();
    this.pollTimer = setTimeout(() => this.loadDfmResult(), DFM_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  // ── Marqueurs superposés au viewer ──

  get defectMarkers(): PcbDefectMarker[] {
    const violations = this.dfm?.violations;
    if (!violations?.length) return [];

    return violations.map((v, i) => ({
      id: i,
      xMm: v.xMm,
      yMm: v.yMm,
      // Le nom de couche porte la face : BOTTOM_COPPER, TOP_COPPER…
      side: (v.layer || '').toUpperCase().includes('BOTTOM') ? 'BOTTOM' as const : 'TOP' as const,
      severity: v.severity,
      label: `${this.violationTypeLabel(v.type)} — ${v.measuredMm} mm (min. ${v.minRequiredMm} mm)`
    }));
  }

  onMarkerClick(marker: PcbDefectMarker): void {
    this.activeMarkerId = this.activeMarkerId === marker.id ? null : marker.id;
    const el = document.getElementById(`dfm-violation-${marker.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  selectViolation(index: number): void {
    this.activeMarkerId = this.activeMarkerId === index ? null : index;
  }

  /** Les 12 types émis par le moteur DFM (ms-bom/dfm_engine.py). */
  violationTypeLabel(type: string): string {
    switch (type) {
      case 'TRACE_WIDTH': return 'Largeur de piste';
      case 'CLEARANCE': return 'Espacement cuivre';
      case 'SHORT_CIRCUIT': return 'Court-circuit';
      case 'ACID_TRAP': return 'Piège à acide';
      case 'BOARD_EDGE_CLEARANCE': return 'Distance au bord';
      case 'DRILL_SIZE': return 'Diamètre de perçage';
      case 'ANNULAR_RING': return 'Couronne de cuivre';
      case 'DRILL_TO_COPPER': return 'Perçage trop près du cuivre';
      case 'HOLE_TO_HOLE': return 'Entraxe des perçages';
      case 'ASPECT_RATIO': return 'Rapport de forme';
      case 'SILK_OVER_PAD': return 'Sérigraphie sur pastille';
      case 'MASK_SLIVER': return 'Pont de vernis épargne';
      default: return type?.replace(/_/g, ' ') || 'Violation';
    }
  }

  /**
   * Tous les contrôles ne se mesurent pas en millimètres : le moteur réutilise
   * les champs `measuredMm` / `minRequiredMm` pour un angle (piège à acide),
   * un rapport sans dimension (aspect ratio) ou une surface (sérigraphie).
   */
  violationUnit(type: string): string {
    switch (type) {
      case 'ACID_TRAP': return '°';
      case 'ASPECT_RATIO': return ':1';
      case 'SILK_OVER_PAD': return ' mm²';
      default: return ' mm';
    }
  }

  /** Selon le contrôle, la valeur de référence est un plancher ou un plafond. */
  violationThresholdLabel(type: string): string {
    switch (type) {
      case 'ACID_TRAP': return 'Seuil';
      case 'ASPECT_RATIO': return 'Max';
      default: return 'Min.';
    }
  }

  /** La sérigraphie sur pastille n'a pas de seuil chiffré : toute surface est un défaut. */
  hasThreshold(type: string): boolean {
    return type !== 'SILK_OVER_PAD';
  }

  // ── Habillage visuel ──

  get severityCounts(): { high: number; medium: number; low: number } {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const v of this.dfm?.violations || []) {
      if (v.severity === 'HIGH') counts.high++;
      else if (v.severity === 'MEDIUM') counts.medium++;
      else counts.low++;
    }
    return counts;
  }

  /** Longueur du trait restant sur la jauge circulaire (circonférence = 326.7). */
  get scoreGaugeOffset(): number {
    const circumference = 2 * Math.PI * 52;
    const score = Math.max(0, Math.min(100, this.dfm?.dfmScore ?? 0));
    return circumference - (score / 100) * circumference;
  }

  gradeClasses(grade?: string): string {
    switch (grade) {
      case 'A': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'B': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'C': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'D': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/30';
    }
  }

  gradeStrokeColor(grade?: string): string {
    switch (grade) {
      case 'A': return '#10b981';
      case 'B': return '#3b82f6';
      case 'C': return '#f59e0b';
      case 'D': return '#f43f5e';
      default: return '#94a3b8';
    }
  }

  severityPillClasses(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'MEDIUM': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      default: return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  }

  severityBarClass(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'bg-rose-500';
      case 'MEDIUM': return 'bg-orange-500';
      default: return 'bg-blue-500';
    }
  }

  severityLabel(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'Critique';
      case 'MEDIUM': return 'Moyen';
      default: return 'Mineur';
    }
  }

  /**
   * Découpe le rapport de l'IA en blocs typés (titre / puce / paragraphe).
   * On n'injecte jamais de HTML brut issu du LLM.
   */
  get reportBlocks(): { type: 'h' | 'li' | 'p'; text: string }[] {
    const raw = this.dfm?.llmReport;
    if (!raw) return [];

    const blocks: { type: 'h' | 'li' | 'p'; text: string }[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Supprimer la ligne de date dans l'analyse DFM (UI + export PDF)
      const cleanForCheck = this.stripInlineMarkdown(
        trimmed.replace(/^#{1,6}\s+/, '').replace(/^([-*•]|\d+\.)\s+/, '')
      );
      if (
        /^date\b(?:\s+du\s+rapport|\s+d['’]analyse|\s+de\s+l['’]analyse|\s+d['’]émission|\s+de\s+génération|\s+of\s+analysis|\s+of\s+report)?\s*[:\-]/i.test(cleanForCheck) ||
        /^date\b\s*[:\-]?\s*\d{1,2}\s+[a-zéû\w]+\s+\d{2,4}/i.test(cleanForCheck) ||
        /^date\b\s*[:\-]?\s*\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/i.test(cleanForCheck)
      ) {
        continue;
      }

      if (/^#{1,6}\s+/.test(trimmed)) {
        blocks.push({ type: 'h', text: this.stripInlineMarkdown(trimmed.replace(/^#{1,6}\s+/, '')) });
      } else if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
        blocks.push({ type: 'h', text: this.stripInlineMarkdown(trimmed) });
      } else if (/^([-*•]|\d+\.)\s+/.test(trimmed)) {
        blocks.push({ type: 'li', text: this.stripInlineMarkdown(trimmed.replace(/^([-*•]|\d+\.)\s+/, '')) });
      } else {
        blocks.push({ type: 'p', text: this.stripInlineMarkdown(trimmed) });
      }
    }
    return blocks;
  }

  /**
   * Retire le balisage inline. Les `_` ne sont supprimés qu'en début/fin de mot,
   * sinon TRACE_WIDTH deviendrait TRACEWIDTH.
   */
  private stripInlineMarkdown(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[:\-]\s*/, '')
      .trim();
  }

  // ══════════════════════════════════════════════════════════════
  // EXPORT PDF
  // ══════════════════════════════════════════════════════════════

  private pdfGradeColor(grade?: string): RGB {
    switch (grade) {
      case 'A': return [16, 185, 129];
      case 'B': return [59, 130, 246];
      case 'C': return [245, 158, 11];
      case 'D': return [244, 63, 94];
      default: return [148, 163, 184];
    }
  }

  private pdfSeverityColor(severity: string): RGB {
    switch (severity) {
      case 'HIGH': return [244, 63, 94];
      case 'MEDIUM': return [249, 115, 22];
      default: return [59, 130, 246];
    }
  }

  /** Éclaircit une couleur vers le blanc — pour les fonds de pastilles. */
  private pdfTint(color: RGB, ratio: number): RGB {
    return [
      Math.round(color[0] + (255 - color[0]) * ratio),
      Math.round(color[1] + (255 - color[1]) * ratio),
      Math.round(color[2] + (255 - color[2]) * ratio)
    ];
  }

  /**
   * Le rapport DFM en PDF.
   *
   * jsPDF est chargé ici et pas en haut du fichier : la bibliothèque pèse
   * plusieurs centaines de kilo-octets, et l'écran l'imposait à tous ceux qui
   * viennent seulement regarder leur carte — avant même le premier affichage.
   * Elle n'arrive maintenant qu'au clic sur le bouton.
   */
  async downloadPdfReport(): Promise<void> {
    if (!this.dfm) return;

    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentW = pageW - margin * 2;

    const grade = this.dfm.grade;
    const gradeColor = this.pdfGradeColor(grade);
    const counts = this.severityCounts;

    let y = 0;

    const addFooters = () => {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('MELQARTX — Rapport d\'analyse DFM / DRC', margin, pageH - 9);
        doc.text(`Page ${i} / ${total}`, pageW - margin, pageH - 9, { align: 'right' });
      }
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = margin;
      }
    };

    // ── En-tête ──────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 42, 'F');

    doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
    doc.rect(0, 40, pageW, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    doc.text('Rapport d\'analyse DFM / DRC', margin, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    const projetLine = this.projet?.nom ? `Projet : ${this.projet.nom}` : 'Projet';
    doc.text(projetLine, margin, 27);
    doc.text(
      `Fichier : ${this.gerberDoc?.nomDocument || 'Gerber'}`,
      margin,
      33
    );

    y = 54;

    // ── Bandeau score ────────────────────────────────────────────
    const cardH = 30;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, cardH, 3, 3, 'FD');

    // Pastille de grade
    const badgeSize = 20;
    const badgeX = margin + 6;
    const badgeY = y + (cardH - badgeSize) / 2;
    doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
    doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(grade || '—', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 2.2, { align: 'center' });

    // Score
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(`${this.dfm.dfmScore ?? '—'}`, badgeX + badgeSize + 8, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('/ 100', badgeX + badgeSize + 8 + doc.getTextWidth(`${this.dfm.dfmScore ?? '—'}`) * 2.55, y + 17);
    doc.setFontSize(7.5);
    doc.text('SCORE DE FABRICABILITÉ', badgeX + badgeSize + 8, y + 23);

    // Compteurs de sévérité
    const tiles: { label: string; value: number; color: RGB }[] = [
      { label: 'Critiques', value: counts.high, color: [244, 63, 94] },
      { label: 'Moyens', value: counts.medium, color: [249, 115, 22] },
      { label: 'Mineurs', value: counts.low, color: [59, 130, 246] }
    ];
    const tileW = 26;
    let tileX = pageW - margin - tiles.length * (tileW + 3) + 3;
    for (const tile of tiles) {
      const bg = this.pdfTint(tile.color, 0.88);
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.setDrawColor(tile.color[0], tile.color[1], tile.color[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(tileX, y + 5, tileW, 20, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(tile.color[0], tile.color[1], tile.color[2]);
      doc.text(String(tile.value), tileX + tileW / 2, y + 14, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(tile.label, tileX + tileW / 2, y + 20.5, { align: 'center' });

      tileX += tileW + 3;
    }

    y += cardH + 12;

    // ── Synthèse de l'IA ─────────────────────────────────────────
    const blocks = this.reportBlocks;
    if (blocks.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Synthèse de l\'ingénieur IA', margin, y);
      doc.setDrawColor(gradeColor[0], gradeColor[1], gradeColor[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, y + 2, margin + 34, y + 2);
      y += 9;

      for (const block of blocks) {
        if (block.type === 'h') {
          ensureSpace(12);
          y += 2;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.8);
          doc.setTextColor(30, 41, 59);
          const lines = doc.splitTextToSize(block.text, contentW);
          doc.text(lines, margin, y);
          y += lines.length * 5 + 1.5;
        } else if (block.type === 'li') {
          const lines = doc.splitTextToSize(block.text, contentW - 6);
          ensureSpace(lines.length * 4.6 + 3);
          doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
          doc.circle(margin + 1.6, y - 1.3, 0.9, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.text(lines, margin + 6, y);
          y += lines.length * 4.6 + 1.6;
        } else {
          const lines = doc.splitTextToSize(block.text, contentW);
          ensureSpace(lines.length * 4.6 + 3);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          doc.text(lines, margin, y);
          y += lines.length * 4.6 + 2.4;
        }
      }
      y += 6;
    }

    // ── Détail des violations ────────────────────────────────────
    const violations = this.dfm.violations || [];
    if (violations.length) {
      ensureSpace(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Violations détectées (${violations.length})`, margin, y);
      doc.setDrawColor(gradeColor[0], gradeColor[1], gradeColor[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, y + 2, margin + 34, y + 2);
      y += 9;

      // En-tête de tableau
      const cols = [margin + 3, margin + 20, margin + 68, margin + 100, margin + 128, margin + 152];
      const drawTableHeader = () => {
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y - 4.5, contentW, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(71, 85, 105);
        doc.text('SÉV.', cols[0], y);
        doc.text('TYPE', cols[1], y);
        doc.text('COUCHE', cols[2], y);
        doc.text('MESURÉ', cols[3], y);
        doc.text('MINIMUM', cols[4], y);
        doc.text('POSITION (mm)', cols[5], y);
        y += 6;
      };
      drawTableHeader();

      const maxRows = Math.min(violations.length, 120);
      for (let i = 0; i < maxRows; i++) {
        const v = violations[i];
        if (y > pageH - 24) {
          doc.addPage();
          y = margin + 6;
          drawTableHeader();
        }

        if (i % 2 === 1) {
          doc.setFillColor(250, 251, 253);
          doc.rect(margin, y - 4, contentW, 6, 'F');
        }

        const sevColor = this.pdfSeverityColor(v.severity);
        doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
        doc.circle(cols[0] + 1.2, y - 1.4, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(51, 65, 85);
        doc.text(doc.splitTextToSize(this.violationTypeLabel(v.type), 45)[0], cols[1], y);
        doc.text(doc.splitTextToSize(v.layer || '—', 30)[0], cols[2], y);
        const unit = this.violationUnit(v.type).trim();
        doc.text(`${v.measuredMm} ${unit}`, cols[3], y);
        doc.text(this.hasThreshold(v.type) ? `${v.minRequiredMm} ${unit}` : '—', cols[4], y);
        doc.text(`${v.xMm?.toFixed?.(2) ?? v.xMm} ; ${v.yMm?.toFixed?.(2) ?? v.yMm}`, cols[5], y);

        y += 6;
      }

      if (violations.length > maxRows) {
        y += 2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.6);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `… et ${violations.length - maxRows} autres violations, consultables dans le visualiseur.`,
          margin,
          y
        );
      }
    }

    addFooters();

    const safeName = (this.projet?.nom || 'projet').replace(/[^\w\-]+/g, '_');
    doc.save(`rapport-dfm-${safeName}.pdf`);
  }

  // ══════════════════════════════════════════════════════════════

  onPcbLoaded(doc: PcbDocument): void {
    this.pcbData = doc;
  }

  goBackToProjet(): void {
    if (this.projet) {
      this.router.navigate(['/client/projets', this.projet.id]);
    } else {
      this.router.navigate(['/client/projets']);
    }
  }

  get formattedArea(): string {
    if (!this.pcbData?.metadata) return 'N/A';
    const w = this.pcbData.metadata.widthMm || 0;
    const h = this.pcbData.metadata.heightMm || 0;
    const areaCm2 = (w * h) / 100;
    return `${areaCm2.toFixed(1)} cm²`;
  }
}
