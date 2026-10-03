import { Component, inject, OnInit } from '@angular/core';
import { aGerber, aPickAndPlace, aSop } from '../../utils/fichiers-techniques';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../../services/projet.service';
import { AuthService } from '../../../../services';
import { Projet, TypeDocumentProjet } from '../../models/projet.models';

@Component({
  selector: 'app-projet-upload-gerber',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './projet-upload-gerber.component.html',
  styleUrls: ['./projet-upload-gerber.component.scss']
})
export class ProjetUploadGerberComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private projetSvc = inject(ProjetService);
  private authSvc   = inject(AuthService);

  loading = true;
  error = '';
  projet?: Projet;

  // ─── Gerber (obligatoire) ───
  gerberFile: File | null = null;
  uploadingGerber = false;
  gerberError = '';
  gerberSuccess = false;
  isDraggingGerber = false;

  // ─── Drill (optionnel) ───
  drillFile: File | null = null;
  uploadingDrill = false;
  drillError = '';
  drillSuccess = false;
  isDraggingDrill = false;

  // ─── Pick & Place (CPL / Centroid) ───
  pickAndPlaceFile: File | null = null;
  uploadingPickAndPlace = false;
  pickAndPlaceError = '';
  pickAndPlaceSuccess = false;
  isDraggingPickAndPlace = false;

  // ─── SOP (Procédure Opératoire Standard) ───
  sopFile: File | null = null;
  uploadingSop = false;
  sopError = '';
  sopSuccess = false;
  isDraggingSop = false;

  // ─── Diagrammes & Schémas (Optionnel) ───
  diagrammeFile: File | null = null;
  uploadingDiagramme = false;
  diagrammeError = '';
  diagrammeSuccess = false;
  isDraggingDiagramme = false;

  // Global state
  successMsg = '';
  completing = false;
  activeTab: 'package' | 'optional' = 'package';

  // ─── Modal de Confirmation de Suppression Ultra-Design ───
  documentToDelete: {
    type: 'GERBER' | 'DRILL_FILE' | 'PICK_AND_PLACE' | 'SOP' | 'DIAGRAMME';
    title: string;
    filename?: string;
    docId?: string;
  } | null = null;
  isDeletingDocument = false;
  modalDeleteError = '';

  isExternalUser(): boolean {
    const role = this.authSvc.role;
    return role === 'CLIENT' || role === 'CLIENT_ENTREPRISE';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projetSvc.getProjet(id).subscribe({
      next: (p) => {
        this.projet = p;
        this.loading = false;
        // Pour IDEE et FAISABILITE, le Gerber n'est pas requis -> redirection directe vers la fiche projet
        if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') {
          this.router.navigate(['/client/projets', p.id]);
          return;
        }
        // Fichiers deja livres : reconnus par la meme regle que partout
        // ailleurs. S'en tenir au type exact affichait « 0 sur 3 » a un client
        // dont le chef de projet avait livre le Gerber en DOCUMENT_TECHNIQUE.
        this.gerberSuccess = aGerber(p.documents);
        this.pickAndPlaceSuccess = aPickAndPlace(p.documents);
        this.sopSuccess = aSop(p.documents);
        this.drillSuccess = !!p.documents?.some(d => d.typeDocument === 'DRILL_FILE');
        this.diagrammeSuccess = !!p.documents?.some(d => d.typeDocument === 'DIAGRAMME');
      },
      error: () => {
        this.error = 'Impossible de charger le projet.';
        this.loading = false;
      }
    });
  }

  // ─── Getters de Préparation & Statuts ───

  isPcbOnly(): boolean {
    if (!this.projet || !this.projet.cadrage?.manufacturingNeeds) return false;
    const mfg = this.projet.cadrage.manufacturingNeeds;
    return mfg.includes('PCB_FAB') && !mfg.includes('SMT_ASSEMBLY') && !mfg.includes('PROTOTYPE_ASSEMBLY');
  }

  isPickAndPlaceRequired(): boolean {
    if (this.isPcbOnly()) return false;
    const obj = this.projet?.cadrage?.objectif;
    return obj === 'PROTOTYPE' || obj === 'PRODUCTION';
  }

  /**
   * La SOP n'est plus exigee.
   *
   * Procedure de montage, redigee quand elle sert : elle accompagne le dossier
   * sans le conditionner. L'ecran continue de la detecter et de l'afficher —
   * la carte porte deja le libelle « Optionnel ».
   */
  isSopRequired(): boolean {
    return false;
  }

  get totalRequiredFiles(): number {
    let count = 1; // Gerber
    if (this.isPickAndPlaceRequired()) count++;
    if (this.isSopRequired()) count++;
    return count;
  }

  get uploadedRequiredFiles(): number {
    let count = 0;
    if (this.gerberSuccess) count++;
    if (this.isPickAndPlaceRequired() && this.pickAndPlaceSuccess) count++;
    if (this.isSopRequired() && this.sopSuccess) count++;
    return count;
  }

  get totalUploadedFiles(): number {
    let count = 0;
    if (this.gerberSuccess) count++;
    if (this.pickAndPlaceSuccess) count++;
    if (this.sopSuccess) count++;
    if (this.drillSuccess) count++;
    if (this.diagrammeSuccess) count++;
    return count;
  }

  get readinessPercentage(): number {
    if (this.totalRequiredFiles === 0) return 100;
    return Math.min(100, Math.round((this.uploadedRequiredFiles / this.totalRequiredFiles) * 100));
  }

  get isReadyToProceed(): boolean {
    return this.uploadedRequiredFiles >= this.totalRequiredFiles;
  }

  // ─── Modal de Suppression ───
  openDeleteModal(type: 'GERBER' | 'DRILL_FILE' | 'PICK_AND_PLACE' | 'SOP' | 'DIAGRAMME', title: string, filename?: string, docId?: string) {
    if (!docId || !this.projet) return;
    this.modalDeleteError = '';
    this.documentToDelete = { type, title, filename: filename || 'Fichier technique', docId };
  }

  cancelDelete() {
    if (this.isDeletingDocument) return;
    this.documentToDelete = null;
    this.modalDeleteError = '';
  }

  executeDelete() {
    if (!this.documentToDelete || !this.projet || !this.documentToDelete.docId) return;
    this.isDeletingDocument = true;
    this.modalDeleteError = '';
    const targetType = this.documentToDelete.type;

    this.projetSvc.deleteDocument(this.projet.id, this.documentToDelete.docId).subscribe({
      next: () => {
        this.isDeletingDocument = false;
        if (targetType === 'GERBER') {
          this.gerberSuccess = false;
          this.gerberFile = null;
        } else if (targetType === 'DRILL_FILE') {
          this.drillSuccess = false;
          this.drillFile = null;
        } else if (targetType === 'PICK_AND_PLACE') {
          this.pickAndPlaceSuccess = false;
          this.pickAndPlaceFile = null;
        } else if (targetType === 'SOP') {
          this.sopSuccess = false;
          this.sopFile = null;
        } else if (targetType === 'DIAGRAMME') {
          this.diagrammeSuccess = false;
          this.diagrammeFile = null;
        }

        this.documentToDelete = null;

        this.projetSvc.getProjet(this.projet!.id).subscribe(p => {
          this.projet = p;
          this.gerberSuccess = aGerber(p.documents);
          this.pickAndPlaceSuccess = aPickAndPlace(p.documents);
          this.sopSuccess = aSop(p.documents);
          this.drillSuccess = !!p.documents?.some(d => d.typeDocument === 'DRILL_FILE');
          this.diagrammeSuccess = !!p.documents?.some(d => d.typeDocument === 'DIAGRAMME');
        });
      },
      error: (err) => {
        this.isDeletingDocument = false;
        this.modalDeleteError = err.error?.message || 'Erreur lors de la suppression du fichier.';
      }
    });
  }

  // ─── Drag & Drop Gerber ───
  onDragOverGerber(event: DragEvent) { event.preventDefault(); this.isDraggingGerber = true; }
  onDragLeaveGerber() { this.isDraggingGerber = false; }
  onDropGerber(event: DragEvent) {
    event.preventDefault();
    this.isDraggingGerber = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setGerberFile(file);
  }
  onGerberFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setGerberFile(input.files[0]);
  }
  setGerberFile(file: File) {
    const allowed = ['.zip', '.rar', '.7z', '.gbr', '.gerber', '.gbl', '.gtl', '.gbs', '.gts'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      this.gerberError = 'Format invalide. Utilisez une archive (.zip, .rar, .7z) ou fichier Gerber natif (.gbr, .gtl, .gbl).';
      this.gerberFile = null;
      return;
    }
    this.gerberFile = file;
    this.gerberError = '';
  }

  uploadGerber() {
    if (!this.gerberFile || !this.projet) return;
    this.uploadingGerber = true;
    this.gerberError = '';
    this.projetSvc.uploadDocument(this.projet.id, this.gerberFile, 'GERBER').subscribe({
      next: () => {
        this.uploadingGerber = false;
        this.gerberSuccess = true;
        this.gerberFile = null;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingGerber = false;
        this.gerberError = err.error?.message || 'Erreur lors du téléversement du Gerber.';
      }
    });
  }

  get gerberDoc() {
    return this.projet?.documents?.find(d => d.typeDocument === 'GERBER');
  }

  deleteGerber() {
    const doc = this.gerberDoc;
    if (!doc || !this.projet) return;
    this.openDeleteModal('GERBER', 'Archive Gerber PCB', doc.nomDocument, doc.id);
  }

  // ─── Drag & Drop Drill ───
  onDragOverDrill(event: DragEvent) { event.preventDefault(); this.isDraggingDrill = true; }
  onDragLeaveDrill() { this.isDraggingDrill = false; }
  onDropDrill(event: DragEvent) {
    event.preventDefault();
    this.isDraggingDrill = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setDrillFile(file);
  }
  onDrillFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setDrillFile(input.files[0]);
  }
  setDrillFile(file: File) {
    const allowed = ['.drl', '.xln', '.nc', '.txt', '.zip', '.rar', '.7z'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      this.drillError = 'Format Drill invalide (.drl, .xln, .nc, .txt, .zip).';
      this.drillFile = null;
      return;
    }
    this.drillFile = file;
    this.drillError = '';
  }

  uploadDrill() {
    if (!this.drillFile || !this.projet) return;
    this.uploadingDrill = true;
    this.drillError = '';
    this.projetSvc.uploadDocument(this.projet.id, this.drillFile, 'DRILL_FILE').subscribe({
      next: () => {
        this.uploadingDrill = false;
        this.drillSuccess = true;
        this.drillFile = null;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingDrill = false;
        this.drillError = err.error?.message || 'Erreur lors du téléversement du Drill.';
      }
    });
  }

  get drillDoc() {
    return this.projet?.documents?.find(d => d.typeDocument === 'DRILL_FILE');
  }

  deleteDrill() {
    const doc = this.drillDoc;
    if (!doc || !this.projet) return;
    this.openDeleteModal('DRILL_FILE', 'Fichier Perçage Drill CNC', doc.nomDocument, doc.id);
  }

  // ─── Drag & Drop Pick & Place (CPL / Centroid) ───
  onDragOverPickAndPlace(event: DragEvent) { event.preventDefault(); this.isDraggingPickAndPlace = true; }
  onDragLeavePickAndPlace() { this.isDraggingPickAndPlace = false; }
  onDropPickAndPlace(event: DragEvent) {
    event.preventDefault();
    this.isDraggingPickAndPlace = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setPickAndPlaceFile(file);
  }
  onPickAndPlaceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setPickAndPlaceFile(input.files[0]);
  }
  setPickAndPlaceFile(file: File) {
    const allowed = ['.csv', '.txt', '.xlsx', '.xls', '.tsv', '.cpl', '.xy'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      this.pickAndPlaceError = 'Format Pick & Place invalide (.csv, .xlsx, .txt, .cpl, .xy).';
      this.pickAndPlaceFile = null;
      return;
    }
    this.pickAndPlaceFile = file;
    this.pickAndPlaceError = '';
  }

  uploadPickAndPlace() {
    if (!this.pickAndPlaceFile || !this.projet) return;
    this.uploadingPickAndPlace = true;
    this.pickAndPlaceError = '';
    this.projetSvc.uploadDocument(this.projet.id, this.pickAndPlaceFile, 'PICK_AND_PLACE').subscribe({
      next: () => {
        this.uploadingPickAndPlace = false;
        this.pickAndPlaceSuccess = true;
        this.pickAndPlaceFile = null;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingPickAndPlace = false;
        this.pickAndPlaceError = err.error?.message || 'Erreur lors du téléversement Pick & Place.';
      }
    });
  }

  get pickAndPlaceDoc() {
    return this.projet?.documents?.find(d => d.typeDocument === 'PICK_AND_PLACE');
  }

  deletePickAndPlace() {
    const doc = this.pickAndPlaceDoc;
    if (!doc || !this.projet) return;
    this.openDeleteModal('PICK_AND_PLACE', 'Fichier Pick & Place (CPL)', doc.nomDocument, doc.id);
  }

  // ─── Drag & Drop SOP (Procédure Opératoire) ───
  onDragOverSop(event: DragEvent) { event.preventDefault(); this.isDraggingSop = true; }
  onDragLeaveSop() { this.isDraggingSop = false; }
  onDropSop(event: DragEvent) {
    event.preventDefault();
    this.isDraggingSop = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setSopFile(file);
  }
  onSopFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setSopFile(input.files[0]);
  }
  setSopFile(file: File) {
    const allowed = ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc', '.txt', '.odt', '.rtf', '.zip', '.rar'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      this.sopError = 'Format SOP invalide (.xlsx, .xls, .csv, .pdf, .docx, .doc, .txt).';
      this.sopFile = null;
      return;
    }
    this.sopFile = file;
    this.sopError = '';
  }

  uploadSop() {
    if (!this.sopFile || !this.projet) return;
    this.uploadingSop = true;
    this.sopError = '';
    this.projetSvc.uploadDocument(this.projet.id, this.sopFile, 'SOP').subscribe({
      next: () => {
        this.uploadingSop = false;
        this.sopSuccess = true;
        this.sopFile = null;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingSop = false;
        this.sopError = err.error?.message || 'Erreur lors du téléversement du fichier SOP.';
      }
    });
  }

  get sopDoc() {
    return this.projet?.documents?.find(d => d.typeDocument === 'SOP');
  }

  deleteSop() {
    const doc = this.sopDoc;
    if (!doc || !this.projet) return;
    this.openDeleteModal('SOP', 'Procédure Opératoire (SOP)', doc.nomDocument, doc.id);
  }

  // ─── Drag & Drop Diagrammes & Schémas Techniques ───
  onDragOverDiagramme(event: DragEvent) { event.preventDefault(); this.isDraggingDiagramme = true; }
  onDragLeaveDiagramme() { this.isDraggingDiagramme = false; }
  onDropDiagramme(event: DragEvent) {
    event.preventDefault();
    this.isDraggingDiagramme = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setDiagrammeFile(file);
  }
  onDiagrammeFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.setDiagrammeFile(input.files[0]);
  }
  setDiagrammeFile(file: File) {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.dwg', '.sch', '.zip', '.rar', '.7z'];
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      this.diagrammeError = 'Format invalide (PDF, Image, DWG, SCH, ZIP).';
      this.diagrammeFile = null;
      return;
    }
    this.diagrammeFile = file;
    this.diagrammeError = '';
  }

  uploadDiagramme() {
    if (!this.diagrammeFile || !this.projet) return;
    this.uploadingDiagramme = true;
    this.diagrammeError = '';
    this.projetSvc.uploadDocument(this.projet.id, this.diagrammeFile, 'DIAGRAMME').subscribe({
      next: () => {
        this.uploadingDiagramme = false;
        this.diagrammeSuccess = true;
        this.diagrammeFile = null;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingDiagramme = false;
        this.diagrammeError = err.error?.message || 'Erreur lors du téléversement du Diagramme.';
      }
    });
  }

  get diagrammeDoc() {
    return this.projet?.documents?.find(d => d.typeDocument === 'DIAGRAMME');
  }

  deleteDiagramme() {
    const doc = this.diagrammeDoc;
    if (!doc || !this.projet) return;
    this.openDeleteModal('DIAGRAMME', 'Schémas & Plans Mécaniques', doc.nomDocument, doc.id);
  }

  goToProjet() {
    if (!this.projet) return;

    if (!this.gerberSuccess) {
      alert('⚠️ Le fichier Gerber est obligatoire pour continuer.');
      return;
    }

    if (this.isPickAndPlaceRequired() && !this.pickAndPlaceSuccess) {
      alert('⚠️ Le fichier Pick & Place (CPL) est obligatoire pour valider votre dossier PCBA.');
      return;
    }

    if (this.isSopRequired() && !this.sopSuccess) {
      alert('⚠️ Le fichier SOP (Procédure Opératoire) est obligatoire pour valider votre dossier PCBA.');
      return;
    }

    // Navigation directe vers l'étape Nomenclature (BOM)
    this.router.navigate(['/client/projets', this.projet.id, 'bom']);
  }

  getFileName(f: File | null) { return f ? f.name : ''; }
  formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  downloadFile(url: string, defaultName?: string) {
    if (!url) return;
    let name = defaultName || 'Document.zip';
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}_/.test(name)) {
      name = name.substring(37);
    }
    if (!name.includes('.')) {
      name += '.zip';
    }
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        window.open(url, '_blank');
      });
  }
}
