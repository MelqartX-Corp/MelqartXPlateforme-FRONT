import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { aGerber, aPickAndPlace, aSop } from '../../utils/fichiers-techniques';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProjetService } from '../../services/projet.service';
import {
  Projet, CadrageRequest, Cadrage,
  Industrie, Objectif, HardwareNeed, FirmwareNeed, ManufacturingNeed, EngagementModel, Timeline
} from '../../models/projet.models';

// ── Option descriptors for Visual Cards ──
interface CardOption<T> { value: T; emoji: string; label: string; desc: string; }

@Component({
  selector: 'app-projet-cadrage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projet-cadrage.component.html',
})
export class ProjetCadrageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projetSvc = inject(ProjetService);

  // ── State ──
  loading = true;
  error = '';
  saving = signal(false);
  saveError = signal('');
  successMsg = signal('');
  projet = signal<Projet | null>(null);
  currentStep = signal(1);

  // ── Selections ──
  selectedIndustrie = signal<Industrie | null>(null);
  selectedObjectif = signal<Objectif | null>(null);
  selectedHardwareNeeds = signal<HardwareNeed[]>([]);
  selectedFirmwareNeeds = signal<FirmwareNeed[]>([]);
  selectedManufacturingNeeds = signal<ManufacturingNeed[]>([]);
  selectedEngagement = signal<EngagementModel | null>(null);
  selectedTimeline = signal<Timeline | null>(null);
  quantiteSouhaitee = signal<number | null>(null);

  // ── Computed Paths & Navigation ──
  isConsultationPath = computed(() => {
    const obj = this.selectedObjectif();
    return obj === 'IDEE' || obj === 'FAISABILITE';
  });

  isValidationPath = computed(() => {
    return this.selectedObjectif() === 'VALIDATION';
  });

  totalSteps = computed(() => {
    if (this.isConsultationPath()) return 2;
    if (this.isValidationPath()) return 4;
    return 5;
  });

  progressPercent = computed(() => Math.round((this.currentStep() / this.totalSteps()) * 100));

  activeSection = computed<'INDUSTRIE' | 'OBJECTIF' | 'BESOINS' | 'ENGAGEMENT' | 'DELAI'>(() => {
    const step = this.currentStep();
    if (this.isConsultationPath()) {
      if (step === 1) return 'INDUSTRIE';
      if (step === 2) return 'OBJECTIF';
    }
    if (this.isValidationPath()) {
      if (step === 1) return 'INDUSTRIE';
      if (step === 2) return 'OBJECTIF';
      if (step === 3) return 'ENGAGEMENT';
      if (step === 4) return 'DELAI';
    }
    // Standard path (PROTOTYPE, PRODUCTION)
    if (step === 1) return 'INDUSTRIE';
    if (step === 2) return 'OBJECTIF';
    if (step === 3) return 'BESOINS';
    if (step === 4) return 'ENGAGEMENT';
    if (step === 5) return 'DELAI';
    return 'INDUSTRIE';
  });

  selectedIndustrieObj = computed(() => {
    const val = this.selectedIndustrie();
    return this.industries.find(o => o.value === val) || null;
  });

  selectedObjectifObj = computed(() => {
    const val = this.selectedObjectif();
    return this.objectifs.find(o => o.value === val) || null;
  });

  selectedEngagementObj = computed(() => {
    const val = this.selectedEngagement();
    return this.engagements.find(o => o.value === val) || null;
  });

  selectedTimelineObj = computed(() => {
    const val = this.selectedTimeline();
    return this.timelines.find(o => o.value === val) || null;
  });

  totalNeedsCount = computed(() => {
    return this.selectedHardwareNeeds().length +
           this.selectedFirmwareNeeds().length +
           this.selectedManufacturingNeeds().length;
  });

  estimatedTimeRemaining = computed(() => {
    if (this.isConsultationPath()) {
      switch (this.currentStep()) {
        case 1: return '1.5 minute restante';
        case 2: return '30 secondes restantes';
        default: return '0 seconde';
      }
    } else if (this.isValidationPath()) {
      switch (this.currentStep()) {
        case 1: return '1.5 minute restante';
        case 2: return '1 minute restante';
        case 3: return '45 secondes restantes';
        case 4: return '15 secondes restantes';
        default: return '0 seconde';
      }
    } else {
      switch (this.currentStep()) {
        case 1: return '2 minutes restantes';
        case 2: return '1.5 minute restante';
        case 3: return '1 minute restante';
        case 4: return '30 secondes restantes';
        case 5: return '15 secondes restantes';
        default: return '0 seconde';
      }
    }
  });

  canProceed = computed(() => {
    switch (this.activeSection()) {
      case 'INDUSTRIE': return !!this.selectedIndustrie();
      case 'OBJECTIF': return !!this.selectedObjectif();
      case 'BESOINS': return this.selectedHardwareNeeds().length > 0
                   || this.selectedFirmwareNeeds().length > 0
                   || this.selectedManufacturingNeeds().length > 0;
      case 'ENGAGEMENT': return !!this.selectedEngagement();
      case 'DELAI': {
        const needsQuantite = this.selectedObjectif() === 'PROTOTYPE' || this.selectedObjectif() === 'PRODUCTION';
        if (needsQuantite) {
          return !!this.selectedTimeline() && !!this.quantiteSouhaitee() && this.quantiteSouhaitee()! > 0;
        }
        return !!this.selectedTimeline();
      }
      default: return false;
    }
  });

  stepLabels = computed<string[]>(() => {
    if (this.isConsultationPath()) return ['Industrie', 'Objectif'];
    if (this.isValidationPath()) return ['Industrie', 'Objectif', 'Engagement', 'Délai'];
    return ['Industrie', 'Objectif', 'Besoins', 'Engagement', 'Délai'];
  });

  stepHeader = computed(() => {
    switch (this.activeSection()) {
      case 'INDUSTRIE': return { icon: '🏭', title: 'Industrie', desc: 'Sélectionnez le secteur principal de votre projet.' };
      case 'OBJECTIF': return { icon: '🎯', title: 'Objectif', desc: "Définissez votre niveau d'avancement actuel." };
      case 'BESOINS': return { icon: '⚙️', title: 'Besoins', desc: 'Déterminez vos besoins matériels et logiciels.' };
      case 'ENGAGEMENT': return { icon: '🤝', title: 'Engagement', desc: 'Choisissez le modèle de collaboration idéal.' };
      case 'DELAI': return { icon: '⏱️', title: 'Délai', desc: 'Indiquez votre calendrier et vos contraintes de temps.' };
      default: return { icon: '📋', title: 'Cadrage', desc: 'Complétez les informations requises.' };
    }
  });

  stepIcon(stepNum: number): string {
    const label = this.stepLabels()[stepNum - 1];
    switch (label) {
      case 'Industrie': return '🏭';
      case 'Objectif': return '🎯';
      case 'Besoins': return '⚙️';
      case 'Engagement': return '🤝';
      case 'Délai': return '⏱️';
      default: return '📄';
    }
  }

  // ── Card Options ──
  industries: CardOption<Industrie>[] = [
    { value: 'IOT', emoji: '🌐', label: 'IoT & Objets Connectés', desc: 'Objets connectés, HW + FW + Cloud' },
    { value: 'AUTOMOTIVE', emoji: '🚗', label: 'Automobile & Mobilité', desc: 'CAN/LIN, diagnostics, télématique' },
    { value: 'INDUSTRIAL', emoji: '🏭', label: 'Industrie & Automatismes', desc: 'IIoT, monitoring, automatismes' },
    { value: 'SMART_INFRASTRUCTURE', emoji: '🏢', label: 'Infrastructures Intelligentes', desc: 'Capteurs, dashboards, bâtiments' },
    { value: 'ENERGY', emoji: '⚡', label: 'Énergie & Cleantech', desc: 'Monitoring, solaire, éolien' },
    { value: 'LOGISTICS', emoji: '🚚', label: 'Logistique & Transport', desc: 'Tracking, gestion de flotte' },
    { value: 'CONSUMER_ELECTRONICS', emoji: '📱', label: 'Électronique Grand Public', desc: 'Produits grand public' },
    { value: 'MEDICAL_SPECIALIZED', emoji: '🏥', label: 'Médical & Hautes Exigences', desc: 'Haute fiabilité, certifications' },
  ];

  objectifs: CardOption<Objectif>[] = [
    { value: 'IDEE', emoji: '💡', label: 'Idée', desc: 'Concept initial, exploration du besoin' },
    { value: 'FAISABILITE', emoji: '🔍', label: 'Faisabilité', desc: 'Étude technique, validation de concept' },
    { value: 'PROTOTYPE', emoji: '🔧', label: 'Prototype', desc: 'Premier exemplaire fonctionnel' },
    { value: 'VALIDATION', emoji: '✅', label: 'Validation', desc: 'Tests, certifications, itérations' },
    { value: 'PRODUCTION', emoji: '🏭', label: 'Production', desc: 'Fabrication en série' },
  ];

  hardwareOptions: CardOption<HardwareNeed>[] = [
    { value: 'ELECTRONIC_DESIGN', emoji: '⚡', label: 'Conception Électronique', desc: 'Schéma complet' },
    { value: 'PCB_DESIGN', emoji: '🔲', label: 'Routage & Design PCB', desc: 'Routage, placement' },
    { value: 'COMPONENT_SELECTION', emoji: '🔍', label: 'Sélection Composants', desc: 'Choix composants' },
    { value: 'POWER_DESIGN', emoji: '🔋', label: 'Alimentation & Puissance', desc: 'Architecture d\'alimentation' },
    { value: 'REDESIGN', emoji: '🔄', label: 'Refonte & Optimisation', desc: 'Refonte produit' },
    { value: 'REVERSE_ENGINEERING', emoji: '🔬', label: 'Rétro-Ingénierie', desc: 'Analyse & reproduction' },
  ];

  firmwareOptions: CardOption<FirmwareNeed>[] = [
    { value: 'FIRMWARE', emoji: '💻', label: 'Firmware Embarqué', desc: 'Code embarqué basique' },
    { value: 'RTOS', emoji: '⏱️', label: 'Système Temps Réel (RTOS)', desc: 'Système temps réel' },
    { value: 'EMBEDDED_LINUX', emoji: '🐧', label: 'Linux Embarqué', desc: 'Système Linux embarqué' },
    { value: 'DRIVERS', emoji: '🔌', label: 'Pilotes (Drivers)', desc: 'Pilotes périphériques' },
    { value: 'OTA', emoji: '📡', label: 'Mises à Jour OTA', desc: 'Mises à jour à distance' },
    { value: 'DEBUGGING', emoji: '🐛', label: 'Débogage & Analyse', desc: 'Débogage, optimisation' },
  ];

  manufacturingOptions: CardOption<ManufacturingNeed>[] = [
    { value: 'PCB_FAB', emoji: '🏭', label: 'Fabrication PCB', desc: 'Fabrication circuits' },
    { value: 'SMT_ASSEMBLY', emoji: '🔧', label: 'Assemblage CMS (SMT)', desc: 'Assemblage composants' },
    { value: 'PROTOTYPE_ASSEMBLY', emoji: '🛠️', label: 'Assemblage Prototypes', desc: 'Assemblage prototypes' },
    { value: 'LOW_VOLUME_PRODUCTION', emoji: '📦', label: 'Petites Séries (Low Volume)', desc: 'Petites séries' },
    { value: 'SOURCING', emoji: '🔗', label: 'Approvisionnement & Sourcing', desc: 'Approvisionnement' },
  ];

  engagements: CardOption<EngagementModel>[] = [
    { value: 'ADVISORY', emoji: '💬', label: 'Conseil & Expertise', desc: 'Conseil uniquement, recommandations' },
    { value: 'ASSISTED_ENGINEERING', emoji: '🤝', label: 'Ingénierie Conjointe', desc: 'Co-développement partagé' },
    { value: 'TURNKEY', emoji: '🔑', label: 'Clé en Main (Turnkey)', desc: 'Clé en main, MelqartX gère tout' },
    { value: 'MANUFACTURING_ONLY', emoji: '🏭', label: 'Fabrication Seule', desc: 'Client fournit designs, on fabrique' },
    { value: 'LONG_TERM_PARTNERSHIP', emoji: '🔄', label: 'Partenariat Long Terme', desc: 'Maintenance, évolutions, support' },
  ];

  timelines: CardOption<Timeline>[] = [
    { value: 'URGENT', emoji: '🔴', label: 'Urgent', desc: 'Priorité maximale, délai court' },
    { value: 'ONE_TO_THREE_MONTHS', emoji: '🟡', label: '1–3 mois', desc: 'Cadre standard' },
    { value: 'THREE_TO_SIX_MONTHS', emoji: '🟢', label: '3–6 mois', desc: 'Cadre standard' },
    { value: 'SIX_PLUS_MONTHS', emoji: '🔵', label: '6+ mois', desc: 'Long terme, roadmap' },
  ];

  // ── Lifecycle ──
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projetSvc.getProjet(id).subscribe({
      next: (p) => {
        this.projet.set(p);
        this.restoreState(p.cadrage);
        this.loading = false;
      },
      error: () => { this.error = 'Projet introuvable'; this.loading = false; }
    });
  }

  isTransitionFromFaisabilite = signal(false);

  /** Restore form state from existing cadrage and jump to correct step */
  private restoreState(cadrage?: Cadrage) {
    if (!cadrage) return;
    if (cadrage.industrie) this.selectedIndustrie.set(cadrage.industrie);
    const p = this.projet();

    if (cadrage.objectif === 'IDEE' || cadrage.objectif === 'FAISABILITE') {
      if (p?.stage === 'PRET_POUR_FLUX') {
        this.isTransitionFromFaisabilite.set(true);
        this.selectedObjectif.set('PROTOTYPE');
        this.selectedEngagement.set('TURNKEY');
      } else {
        this.isTransitionFromFaisabilite.set(false);
        this.selectedObjectif.set(cadrage.objectif);
        this.selectedEngagement.set('ADVISORY');
      }
    } else if (cadrage.objectif === 'PROTOTYPE') {
      this.isTransitionFromFaisabilite.set(false);
      this.selectedObjectif.set('PROTOTYPE');
      const cur = cadrage.engagementModel;
      if (cur === 'ADVISORY' || cur === 'ASSISTED_ENGINEERING' || !cur) {
        this.selectedEngagement.set('TURNKEY');
      }
    } else if (cadrage.objectif === 'VALIDATION') {
      this.isTransitionFromFaisabilite.set(false);
      this.selectedObjectif.set('VALIDATION');
      this.selectedEngagement.set('ASSISTED_ENGINEERING');
    } else if (cadrage.objectif === 'PRODUCTION') {
      this.isTransitionFromFaisabilite.set(false);
      this.selectedObjectif.set('PRODUCTION');
      const cur = cadrage.engagementModel;
      if (cur === 'ADVISORY' || cur === 'ASSISTED_ENGINEERING' || !cur) {
        this.selectedEngagement.set('TURNKEY');
      }
    } else if (cadrage.objectif) {
      this.selectedObjectif.set(cadrage.objectif);
    }
    if (cadrage.hardwareNeeds) this.selectedHardwareNeeds.set(cadrage.hardwareNeeds);
    if (cadrage.firmwareNeeds) this.selectedFirmwareNeeds.set(cadrage.firmwareNeeds);
    if (cadrage.manufacturingNeeds) this.selectedManufacturingNeeds.set(cadrage.manufacturingNeeds);
    if (cadrage.engagementModel) this.selectedEngagement.set(cadrage.engagementModel);
    if (cadrage.timeline) this.selectedTimeline.set(cadrage.timeline);
    if (cadrage.quantiteSouhaitee) this.quantiteSouhaitee.set(cadrage.quantiteSouhaitee);
    this.currentStep.set(this.computeInitialStep(cadrage));
  }

  private computeInitialStep(c: Cadrage): number {
    if (!c.industrie) return 1;
    if (!c.objectif) return 2;
    if (c.objectif === 'IDEE' || c.objectif === 'FAISABILITE') return 2;
    if (c.objectif === 'VALIDATION') {
      if (!c.engagementModel) return 3;
      if (!c.timeline) return 4;
      return 4;
    }
    const hasNeeds = (c.hardwareNeeds?.length ?? 0) > 0
                  || (c.firmwareNeeds?.length ?? 0) > 0
                  || (c.manufacturingNeeds?.length ?? 0) > 0;
    if (!hasNeeds) return 3;
    if (!c.engagementModel) return 4;
    if (!c.timeline) return 5;
    return 5;
  }

  // ── Navigation ──
  next() {
    if (!this.canProceed()) return;
    this.saveCurrentStep(() => {
      if (this.currentStep() < this.totalSteps()) {
        this.currentStep.update(s => s + 1);
      }
    });
  }

  prev() {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  /** Save current step data via PUT /cadrage */
  private saveCurrentStep(onSuccess: () => void) {
    const p = this.projet();
    if (!p) return;

    const req: CadrageRequest = {};
    switch (this.activeSection()) {
      case 'INDUSTRIE':
        req.industrie = this.selectedIndustrie()!;
        break;
      case 'OBJECTIF':
        // Si on est en train de transitionner depuis Faisabilité/Idée, on ne modifie pas l'objectif en base maintenant
        // afin que transitionToPrototype() à la fin puisse archiver la phase et faire la transition
        if (!this.isTransitionFromFaisabilite()) {
          req.objectif = this.selectedObjectif()!;
        }
        if (this.isConsultationPath()) {
          req.engagementModel = 'ADVISORY';
          this.selectedEngagement.set('ADVISORY');
        } else if (this.isValidationPath()) {
          req.engagementModel = 'ASSISTED_ENGINEERING';
          this.selectedEngagement.set('ASSISTED_ENGINEERING');
        }
        break;
      case 'BESOINS':
        req.hardwareNeeds = this.selectedHardwareNeeds();
        req.firmwareNeeds = this.selectedFirmwareNeeds();
        req.manufacturingNeeds = this.selectedManufacturingNeeds();
        break;
      case 'ENGAGEMENT':
        req.engagementModel = this.selectedEngagement()!;
        break;
      case 'DELAI':
        req.timeline = this.selectedTimeline()!;
        if (this.quantiteSouhaitee()) {
          req.quantiteSouhaitee = this.quantiteSouhaitee()!;
        }
        break;
    }

    this.saving.set(true);
    this.saveError.set('');
    this.projetSvc.updateCadrage(p.id, req).subscribe({
      next: (updated) => {
        this.projet.set(updated);
        this.saving.set(false);
        onSuccess();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Erreur de sauvegarde. Veuillez réessayer.');
        setTimeout(() => this.saveError.set(''), 5000);
      }
    });
  }

  isObjectifLocked = computed(() => {
    const p = this.projet();
    return !!(p?.historiquePhases && p.historiquePhases.length > 0);
  });

  isObjectifDisabled(v: Objectif): boolean {
    const p = this.projet();
    if (this.isTransitionFromFaisabilite()) {
      return v !== 'PROTOTYPE';
    }
    if (this.isObjectifLocked()) {
      return v !== p?.cadrage?.objectif;
    }
    return false;
  }

  // ── Engagement rules per Objectif ──
  isEngagementDisabled(v: EngagementModel): boolean {
    const obj = this.selectedObjectif();
    if (obj === 'VALIDATION') {
      return v !== 'ASSISTED_ENGINEERING';
    }
    if (obj === 'PROTOTYPE' || obj === 'PRODUCTION') {
      return v === 'ADVISORY' || v === 'ASSISTED_ENGINEERING';
    }
    return false;
  }

  // ── Selections ──
  selectIndustrie(v: Industrie) { this.selectedIndustrie.set(v); }
  
  selectObjectif(v: Objectif) {
    if (this.isObjectifLocked() && v !== 'PROTOTYPE') return;
    this.selectedObjectif.set(v);

    if (v === 'IDEE' || v === 'FAISABILITE') {
      this.selectedEngagement.set('ADVISORY');
    } else if (v === 'VALIDATION') {
      this.selectedEngagement.set('ASSISTED_ENGINEERING');
    } else if (v === 'PROTOTYPE' || v === 'PRODUCTION') {
      const cur = this.selectedEngagement();
      if (cur === 'ADVISORY' || cur === 'ASSISTED_ENGINEERING' || !cur) {
        this.selectedEngagement.set('TURNKEY');
      }
    }
  }

  selectEngagement(v: EngagementModel) {
    if (this.isEngagementDisabled(v)) return;
    this.selectedEngagement.set(v);
  }

  selectTimeline(v: Timeline) { this.selectedTimeline.set(v); }
  setQuantite(v: number) { this.quantiteSouhaitee.set(v); }

  toggleHardware(v: HardwareNeed) {
    this.selectedHardwareNeeds.update(list =>
      list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }
  toggleFirmware(v: FirmwareNeed) {
    this.selectedFirmwareNeeds.update(list =>
      list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }
  toggleManufacturing(v: ManufacturingNeed) {
    this.selectedManufacturingNeeds.update(list =>
      list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  isHardwareSelected(v: HardwareNeed): boolean { return this.selectedHardwareNeeds().includes(v); }
  isFirmwareSelected(v: FirmwareNeed): boolean { return this.selectedFirmwareNeeds().includes(v); }
  isManufacturingSelected(v: ManufacturingNeed): boolean { return this.selectedManufacturingNeeds().includes(v); }

  // ── Final submissions ──
  submitConsultation() {
    const p = this.projet();
    if (!p) return;

    const req: CadrageRequest = {
      industrie: this.selectedIndustrie()!,
      objectif: this.selectedObjectif()!,
      engagementModel: 'ADVISORY'
    };

    this.saving.set(true);
    this.saveError.set('');
    this.projetSvc.updateCadrage(p.id, req).subscribe({
      next: (updated) => {
        this.projet.set(updated);
        this.saving.set(false);
        this.successMsg.set('Votre demande de consultation a été enregistrée !');
        const targetRoute = ['/client/projets', updated.id];
        setTimeout(() => this.router.navigate(targetRoute), 800);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Erreur de sauvegarde. Veuillez réessayer.');
        setTimeout(() => this.saveError.set(''), 5000);
      }
    });
  }

  // ── Transition Modal State ──
  showTransitionModal = signal(false);
  selectedBomFileUrl = signal('');
  transitioning = signal(false);
  transitionError = signal('');

  getExcelOrCsvFiles(): string[] {
    const p = this.projet();
    if (!p || !p.documents) return [];
    const urls: string[] = [];

    p.documents.forEach(d => {
      if (d.typeDocument === 'PICK_AND_PLACE' || d.typeDocument === 'GERBER' || d.typeDocument === 'DRILL_FILE' || d.typeDocument === 'SOP') return;
      const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || d.typeDocument === 'BOM') {
        const val = d.fileUrl || d.id;
        if (val && !urls.includes(val)) urls.push(val);
      }
    });

    return urls;
  }

  hasPickAndPlace(p: any): boolean {
    if (!p || !p.documents) return false;
    return p.documents.some((d: any) => d.typeDocument === 'PICK_AND_PLACE');
  }

  getFileNameFromUrl(url: string): string {
    if (!url) return '';
    const clean = url.split('?')[0].split('#')[0];
    return clean.substring(clean.lastIndexOf('/') + 1);
  }

  get isPcbOnly(): boolean {
    const obj = this.selectedObjectif() || this.projet()?.cadrage?.objectif;
    if (obj !== 'PROTOTYPE') return false;

    const mfg = this.selectedManufacturingNeeds();
    return mfg.includes('PCB_FAB') && !mfg.includes('SMT_ASSEMBLY') && !mfg.includes('PROTOTYPE_ASSEMBLY');
  }

  /**
   * L'etat des quatre fichiers que la phase Prototype reclame.
   *
   * La fenetre de bascule n'en annoncait que deux — Gerber et BOM — alors que
   * le dossier en exige quatre. Le client validait sans savoir qu'il lui
   * manquait le Pick & Place, et l'apprenait apres coup sur un ecran de depot.
   *
   * Aucun de ces manques n'empeche la bascule : le projet avance, et l'ecran
   * de depot prend le relais. Ils sont montres pour etre su, pas pour bloquer.
   */
  dossierTechnique(): { cle: string; libelle: string; present: boolean; requis: boolean }[] {
    const docs = this.projet()?.documents;
    return [
      { cle: 'GERBER', libelle: 'Fichier Gerber', present: aGerber(docs), requis: true },
      { cle: 'PNP', libelle: 'Pick & Place (CPL)', present: aPickAndPlace(docs), requis: true },
      { cle: 'BOM', libelle: 'Nomenclature (BOM)', present: this.getExcelOrCsvFiles().length > 0, requis: true },
      // Optionnelle : montree parce qu'elle compte quand elle est la, pas
      // parce que le dossier l'attend.
      { cle: 'SOP', libelle: 'Procédure de montage (SOP)', present: aSop(docs), requis: false }
    ];
  }

  get dossierComplet(): boolean {
    return this.dossierTechnique().every(f => !f.requis || f.present);
  }

  /** Le compteur ne parle que des pieces attendues. */
  get nbFichiersRequis(): number {
    return this.dossierTechnique().filter(f => f.requis).length;
  }

  get nbFichiersPresents(): number {
    return this.dossierTechnique().filter(f => f.requis && f.present).length;
  }

  hasGerber(p: any): boolean {
    if (!p || !p.documents) return false;
    return p.documents.some((d: any) => {
      if (d.typeDocument === 'GERBER') return true;
      const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
      return name.includes('gerber') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
    });
  }

  openTransitionModal() {
    this.transitionError.set('');
    const files = this.getExcelOrCsvFiles();
    if (files.length > 0) {
      this.selectedBomFileUrl.set(files[0]);
    } else {
      this.selectedBomFileUrl.set('');
    }
    this.showTransitionModal.set(true);
  }

  submitFinal() {
    this.saveCurrentStep(() => {
      const p = this.projet();
      if (!p) {
        this.router.navigate(['/client/projets']);
        return;
      }

      // ── Cas A : Transition depuis Faisabilité / Idée ──
      const isAlreadyPrototype = p.cadrage?.objectif === 'PROTOTYPE' || (p.historiquePhases && p.historiquePhases.length > 0);
      if (this.isTransitionFromFaisabilite() && !isAlreadyPrototype) {
        const excelFiles = this.getExcelOrCsvFiles();
        if (excelFiles.length > 0) {
          this.selectedBomFileUrl.set(excelFiles[0]);
        } else {
          this.selectedBomFileUrl.set('');
        }
        this.transitionError.set('');
        this.showTransitionModal.set(true);
        return;
      }

      // ── Cas B : Création directe d'un projet (sans transition) ──
      const hasGerber = this.hasGerber(p);
      const hasBom = !!p.bomUploaded || (p.documents && p.documents.some(d => d.typeDocument === 'BOM'));
      this.successMsg.set('Cadrage enregistré avec succès !');

      if (p.cadrage?.objectif === 'VALIDATION') {
        if (!hasGerber) {
          this.successMsg.set('Cadrage enregistré ! Redirection vers le téléversement Gerber...');
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'upload-gerber']), 800);
        } else if (!hasBom && !this.isPcbOnly) {
          this.successMsg.set('Cadrage enregistré ! Redirection vers l\'import de la BOM...');
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'bom']), 800);
        } else {
          setTimeout(() => this.router.navigate(['/client/projets', p.id]), 800);
        }
        return;
      }

      if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') {
        setTimeout(() => this.router.navigate(['/client/projets', p.id]), 800);
        return;
      }

      if (p.cadrage?.objectif === 'PRODUCTION') {
        if (!hasGerber) {
          this.successMsg.set('Cadrage enregistré ! Redirection vers le téléversement Gerber (Étape 1/2)...');
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'upload-gerber']), 800);
        } else if (!hasBom) {
          this.successMsg.set('Cadrage enregistré ! Redirection vers l\'importation de la BOM (Étape 2/2)...');
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'bom']), 800);
        } else {
          setTimeout(() => this.router.navigate(['/client/projets', p.id]), 800);
        }
        return;
      }

      if (this.isPcbOnly) {
        if (hasGerber) {
          setTimeout(() => this.router.navigate(['/client/projets', p.id]), 800);
        } else {
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'upload-gerber']), 800);
        }
      } else {
        // PCBA (PCB + Assemblage)
        const hasPnp = this.hasPickAndPlace(p);
        if (!hasGerber || !hasPnp) {
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'upload-gerber']), 800);
        } else if (!hasBom) {
          setTimeout(() => this.router.navigate(['/client/projets', p.id, 'bom']), 800);
        } else {
          setTimeout(() => this.router.navigate(['/client/projets', p.id]), 800);
        }
      }
    });
  }

  closeTransitionModal() {
    this.showTransitionModal.set(false);
    this.transitionError.set('');
  }

  confirmTransition() {
    const p = this.projet();
    if (!p) return;

    const isAlreadyPrototype = p.cadrage?.objectif === 'PROTOTYPE' || (p.historiquePhases && p.historiquePhases.length > 0);
    if (isAlreadyPrototype) {
      this.showTransitionModal.set(false);
      this.router.navigate(['/client/projets', p.id]);
      return;
    }

    let bomFileId = '';
    if (!this.isPcbOnly) {
      const excelFiles = this.getExcelOrCsvFiles();
      if (excelFiles.length > 0 && !this.selectedBomFileUrl()) {
        this.transitionError.set('Veuillez sélectionner un fichier BOM pour la transition.');
        return;
      }

      if (this.selectedBomFileUrl()) {
        bomFileId = this.selectedBomFileUrl();
      } else if (excelFiles.length > 0) {
        bomFileId = excelFiles[0];
      }
    }

    this.transitioning.set(true);
    this.transitionError.set('');

    this.projetSvc.transitionToPrototype(p.id, bomFileId).subscribe({
      next: (updatedProjet) => {
        this.transitioning.set(false);
        this.showTransitionModal.set(false);

        const hasGerber = this.hasGerber(updatedProjet);

        if (this.isPcbOnly) {
          if (hasGerber) {
            this.successMsg.set('Cadrage complet ! Transition vers le Prototype PCB validée.');
            setTimeout(() => this.router.navigate(['/client/projets', updatedProjet.id]), 1000);
          } else {
            this.successMsg.set('Cadrage complet ! Redirection vers le dépôt des fichiers Gerber...');
            setTimeout(() => this.router.navigate(['/client/projets', updatedProjet.id, 'upload-gerber']), 1000);
          }
        } else {
          const hasPnp = updatedProjet.documents?.some((d: any) => d.typeDocument === 'PICK_AND_PLACE');
          const hasBom = updatedProjet.bomUploaded || !!bomFileId || updatedProjet.documents?.some((d: any) => d.typeDocument === 'BOM');

          if (hasGerber && hasPnp && hasBom) {
            // Meme destination que depuis la fiche projet : la nomenclature,
            // ou le dossier se poursuit reellement.
            this.successMsg.set('Transition validée — fichiers techniques complets. Ouverture de la nomenclature...');
            setTimeout(() => this.router.navigate(['/client/projets', updatedProjet.id, 'bom']), 800);
          } else {
            this.successMsg.set('Transition validée ! Redirection pour compléter les fichiers requis (Pick & Place)...');
            setTimeout(() => this.router.navigate(['/client/projets', updatedProjet.id, 'upload-gerber']), 1000);
          }
        }
      },
      error: (err) => {
        this.transitioning.set(false);
        this.transitionError.set(err.error?.message || err.message || 'Erreur lors de la transition vers la phase Prototype.');
      }
    });
  }
}
