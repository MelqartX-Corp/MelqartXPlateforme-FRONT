import { Component, inject, OnInit } from '@angular/core'; // Touch
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../../services/projet.service';
import { AuthService } from '../../../../services';
import { Projet, BomResponse, ProjectStockStatusResponse, StockCheckComponent, ProjetStatut, AlternativeProvider, Alternative, AlternativeResponse, BomComponentDecisionRequest, DecisionType } from '../../models/projet.models';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-projet-bom',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './projet-bom.component.html',
  styleUrls: ['./projet-bom.component.scss']
})
export class ProjetBomComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);

  loading = true;
  error = '';
  projet?: Projet;
  userRole = 'CLIENT';

  isPcbOnly(): boolean {
    if (!this.projet || !this.projet.cadrage?.manufacturingNeeds) return false;
    const mfg = this.projet.cadrage.manufacturingNeeds;
    return mfg.includes('PCB_FAB') && !mfg.includes('SMT_ASSEMBLY') && !mfg.includes('PROTOTYPE_ASSEMBLY');
  }

  // BOM & Stock states
  bomData: BomResponse | null = null;
  loadingBom = false;
  uploading = false;
  uploadError = '';
  isDragging = false;
  checkingStock = false;
  stockCheckError = '';
  stockDetails: ProjectStockStatusResponse | null = null;

  // Success & Error toasts
  successMsg = '';
  errorToastMsg = '';

  showToast(msg: string) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 4000);
  }

  showErrorToast(msg: string) {
    this.errorToastMsg = msg;
    setTimeout(() => this.errorToastMsg = '', 5000);
  }

  // Alternatives states
  loadingAlternatives = false;
  alternativesError = '';
  selectedProvider: AlternativeProvider = 'ALL';
  expandedMpn: string | null = null;
  providers: AlternativeProvider[] = ['MOUSER', 'DIGIKEY', 'ALL'];
  private alternativesCache = new Map<string, Alternative[]>();

  ngOnInit() {
    this.userRole = this.authSvc.role || 'CLIENT';
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadProjet(id);
  }

  loadProjet(id: string) {
    this.loading = true;
    this.projetSvc.getProjet(id).subscribe({
      next: (p) => {
        this.projet = p;

        this.loading = false;

        if (this.hasBomDocument()) {
          this.loadBom();
          this.loadStockStatus();
        }
      },
      error: () => {
        this.error = 'Projet introuvable';
        this.loading = false;
      }
    });
  }

  hasBomDocument(): boolean {
    if (!this.projet) return false;
    if (this.projet.bomUploaded) return true;
    if (this.projet.documents && this.projet.documents.length > 0) {
      return this.projet.documents.some((d: any) => {
        if (d.typeDocument === 'BOM') return true;
        if (d.typeDocument === 'SOP' || d.typeDocument === 'PICK_AND_PLACE' || d.typeDocument === 'GERBER' || d.typeDocument === 'DRILL_FILE') return false;
        const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
        return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
      });
    }
    return false;
  }

  get isProjectOwner(): boolean {
    if (!this.projet) return false;
    return this.isExternalUser() && this.projet.userId === this.authSvc.currentUser?.id;
  }

  isExternalUser(): boolean {
    const role = this.authSvc.role || this.userRole;
    return role === 'CLIENT' || role === 'CLIENT_ENTREPRISE';
  }

  /** Admin ou Support Technique → voit la colonne "Dispo. Stock" */
  get isAdminOrSupport(): boolean {
    return this.userRole === 'ADMINISTRATEUR' || this.userRole === 'SUPPORT_TECHNIQUE';
  }

  /** Client ou Client Entreprise → voit la colonne "Marque" */
  get isClient(): boolean {
    return this.isExternalUser();
  }

  loadBom() {
    if (!this.projet) return;
    this.loadingBom = true;
    this.projetSvc.getBom(this.projet.id).subscribe({
      next: (bom) => {
        this.bomData = bom;
        this.loadingBom = false;
      },
      error: () => { this.loadingBom = false; }
    });
  }

  loadStockStatus() {
    if (!this.projet) return;
    this.checkingStock = true;
    this.stockCheckError = '';
    this.projetSvc.getStockStatus(this.projet.id).subscribe({
      next: (res) => {
        if (res.status === 'UNKNOWN') {
          this.stockCheckError = res.message || 'Service stock indisponible.';
          this.stockDetails = null;
        } else {
          this.stockDetails = res;
        }
        this.checkingStock = false;
      },
      error: (err) => {
        this.checkingStock = false;
        this.stockCheckError = err.error?.message || 'Impossible de récupérer le statut des stocks.';
      }
    });
  }

  get totalComponentsCount(): number {
    return this.bomData?.components?.length || 0;
  }

  get availableComponentsCount(): number {
    if (!this.stockDetails) return 0;
    return this.stockDetails.details.filter(d => d.status === 'AVAILABLE' || d.status === 'AVAILABLE_WITH_DELAY').length;
  }

  get partialComponentsCount(): number {
    if (!this.stockDetails) return 0;
    return this.stockDetails.details.filter(d => d.status === 'PARTIAL' || d.status === 'PARTIAL_WITH_DELAY').length;
  }

  get missingComponentsCount(): number {
    if (!this.stockDetails) return 0;
    return this.stockDetails.details.filter(d => d.status === 'MISSING').length;
  }

  /**
   * Indique si le client a refusé la recherche d'alternatives (Non général / Prise en charge client).
   */
  get hasRefusedAlternatives(): boolean {
    if (!this.bomData || !this.bomData.decisions || this.bomData.decisions.length === 0) {
      return false;
    }
    const hasClientSupply = this.bomData.decisions.some(d => d.decisionType === 'CLIENT_SUPPLY');
    const hasAcceptedAlternative = this.bomData.decisions.some(d => d.decisionType === 'ACCEPT_ALTERNATIVE');
    return hasClientSupply && !hasAcceptedAlternative;
  }


  get isValidationProject(): boolean {
    return this.projet?.cadrage?.objectif === 'VALIDATION';
  }

  /**
   * Détermine si la colonne et les boutons d'alternatives doivent être affichés.
   * La colonne n'apparaît que si le client a choisi "Rechercher des alternatives" (oui).
   *
   * Elle reste ouverte tant qu'un composant attend encore un arbitrage : un
   * "Non-soudé" posé sur une ligne ne dit rien des autres, et le fermer pour
   * tout le monde priverait le client des alternatives qu'il n'a pas refusées.
   */
  get shouldShowAlternativesColumn(): boolean {
    if (!this.projet) return false;
    if (this.isValidationProject) return false;
    // PRIORITÉ 1 : le client a mis TOUS ses manquants en "Non-soudé" — il n'y
    // a plus rien à arbitrer, la colonne n'a plus d'objet.
    if (this.hasGlobalClientSupply) return false;
    // PRIORITÉ 2 : afficher si stage = ALTERNATIVES_EN_ATTENTE (client a dit oui)
    const stage = this.projet.stage;
    if (stage === 'ALTERNATIVES_EN_ATTENTE') return true;
    // Afficher si des décisions ACCEPT_ALTERNATIVE existent déjà
    if (this.bomData?.decisions?.some(d => d.decisionType === 'ACCEPT_ALTERNATIVE')) return true;
    return false;
  }


  getStockComponentStatus(mpn: string): StockCheckComponent | undefined {
    return this.stockDetails?.details.find(d => d.mpn === mpn);
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {
    if (!this.projet) return;
    this.uploading = true;
    this.uploadError = '';
    this.projetSvc.uploadBom(this.projet.id, file).subscribe({
      next: (bomResponse) => {
        this.bomData = bomResponse;
        // Refresh project state to update flags
        this.projetSvc.getProjet(this.projet!.id).subscribe({
          next: (p) => this.projet = p
        });
        this.uploading = false;
        this.showToast('Fichier BOM importé avec succès !');
        this.loadStockStatus();
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err.error?.message || 'Erreur lors de l\'importation du fichier BOM.';
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      const allowedExtensions = /(\.xlsx|\.xls|\.csv)$/i;
      if (!allowedExtensions.exec(file.name)) {
        this.uploadError = 'Format de fichier non supporté. Veuillez utiliser un fichier .xlsx, .xls ou .csv.';
        return;
      }
      this.uploadFile(file);
    }
  }

  statusBg(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': case 'PENDING': return 'hsl(var(--warning)/0.12)';
      case 'QUOTED': return 'hsl(var(--primary)/0.12)';
      case 'CONFIRMED': return 'hsl(var(--success)/0.12)';
      case 'IN_PROGRESS': return 'rgba(99, 102, 241, 0.12)';
      case 'COMPLETED': return 'hsl(var(--success)/0.12)';
      case 'ARCHIVED': return 'hsl(var(--muted-foreground)/0.12)';
      case 'CANCELLED': return 'hsl(var(--destructive)/0.12)';
      default: return 'hsl(var(--muted)/0.12)';
    }
  }

  statusColor(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': case 'PENDING': return 'hsl(var(--warning))';
      case 'QUOTED': return 'hsl(var(--primary))';
      case 'CONFIRMED': return 'hsl(var(--success))';
      case 'IN_PROGRESS': return '#6366f1';
      case 'COMPLETED': return 'hsl(var(--success))';
      case 'ARCHIVED': return 'hsl(var(--muted-foreground))';
      case 'CANCELLED': return 'hsl(var(--destructive))';
      default: return 'hsl(var(--muted))';
    }
  }

  statusDotClass(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': case 'PENDING': return 'status-dot-warning';
      case 'QUOTED': return 'status-dot-primary';
      case 'CONFIRMED': return 'status-dot-success';
      case 'IN_PROGRESS': return 'status-dot-indigo';
      case 'COMPLETED': return 'status-dot-success';
      case 'ARCHIVED': return 'status-dot-muted';
      case 'CANCELLED': return 'status-dot-destructive';
      default: return 'status-dot-muted';
    }
  }

  statusLabel(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return 'Brouillon'; case 'PENDING': return 'En attente';
      case 'QUOTED': return 'Quoted'; case 'CONFIRMED': return 'Confirmé';
      case 'IN_PROGRESS': return 'En cours'; case 'COMPLETED': return 'Terminé';
      case 'ARCHIVED': return 'Archivé'; case 'CANCELLED': return 'Annulé';
      default: return 'Inconnu';
    }
  }



  searchAlternatives(mpn?: string) {
    const targetMpn = mpn || this.expandedMpn;
    if (!targetMpn || !this.projet) return;

    const cacheKey = `${targetMpn}_${this.selectedProvider}`;
    if (this.alternativesCache.has(cacheKey)) return;

    this.loadingAlternatives = true;
    this.alternativesError = '';
    this.projetSvc.findAlternatives(this.projet.id, this.selectedProvider, targetMpn).subscribe({
      next: (data) => {
        const componentResponse = data.find(
          r => r.mpnOriginal && r.mpnOriginal.toLowerCase() === targetMpn.toLowerCase()
        );
        const alternativesList = componentResponse ? componentResponse.alternatives : [];
        this.alternativesCache.set(cacheKey, alternativesList);
        this.loadingAlternatives = false;
      },
      error: () => {
        this.loadingAlternatives = false;
        this.alternativesError = 'Le service d\'alternatives est temporairement indisponible.';
      }
    });
  }

  getAlternatives(mpn: string): Alternative[] {
    const cacheKey = `${mpn}_${this.selectedProvider}`;
    return this.alternativesCache.get(cacheKey) || [];
  }

  toggleExpand(mpn: string) {
    this.expandedMpn = this.expandedMpn === mpn ? null : mpn;
    if (this.expandedMpn) {
      this.searchAlternatives(mpn);
    }
  }

  onProviderChange(provider: AlternativeProvider) {
    this.selectedProvider = provider;
    if (this.expandedMpn) {
      this.searchAlternatives(this.expandedMpn);
    }
  }

  // ═══════════════════════════════════════════════════
  // Scénario 2 — Actions & Décisions BOM
  // ═══════════════════════════════════════════════════

  submittingDecision = false;
  validatingBom = false;
  decisionError = '';

  getQuantiteSouhaitee(): number {
    return this.projet?.cadrage?.quantiteSouhaitee || 1;
  }

  getTotalRequiredQuantity(qty: number): number {
    return qty * this.getQuantiteSouhaitee();
  }

  get hasMissingOrPartial(): boolean {
    return (this.partialComponentsCount + this.missingComponentsCount) > 0;
  }

  get isBomValidated(): boolean {
    return this.bomData?.lifecycleState === 'VALIDATED' || this.projet?.stage === 'BOM_VALIDEE';
  }

  getDecisionForMpn(mpn: string) {
    if (!this.bomData?.decisions) return null;
    return this.bomData.decisions.find(d => d.componentMpnOriginal.toLowerCase() === mpn.toLowerCase());
  }

  isAlternativeSelected(compMpn: string, altMpn: string): boolean {
    const decision = this.getDecisionForMpn(compMpn);
    return decision?.decisionType === 'ACCEPT_ALTERNATIVE' && decision?.approvedMpn?.toLowerCase() === altMpn.toLowerCase();
  }

  isClientSupplySelected(compMpn: string): boolean {
    const decision = this.getDecisionForMpn(compMpn);
    return decision?.decisionType === 'CLIENT_SUPPLY';
  }

  get hasAnyClientSupplyDecision(): boolean {
    if (!this.bomData?.decisions) return false;
    return this.bomData.decisions.some(d => d.decisionType === 'CLIENT_SUPPLY');
  }

  /** Les MPN qui posent problème : rupture ou quantité insuffisante. */
  get problematicMpns(): string[] {
    if (!this.stockDetails) return [];
    return this.stockDetails.details
      .filter(d => d.status !== 'AVAILABLE' && d.status !== 'AVAILABLE_WITH_DELAY')
      .map(d => d.mpn);
  }

  /**
   * Le client a-t-il mis TOUS ses composants manquants en prise en charge ?
   *
   * La distinction compte : le refus global et le choix ligne à ligne écrivent
   * la même décision CLIENT_SUPPLY côté serveur. Compter les lignes est le
   * seul moyen de savoir si c'est un arbitrage isolé — auquel cas le reste de
   * la BOM garde ses alternatives — ou le refus d'ensemble.
   */
  get hasGlobalClientSupply(): boolean {
    const problematiques = this.problematicMpns;
    if (problematiques.length === 0) return false;
    return problematiques.every(mpn => this.isClientSupplySelected(mpn));
  }

  /**
   * Action sur le Prompt composant manquant (OUI / NON)
   */
  onPromptDecision(accept: boolean) {
    if (!this.projet) return;
    this.submittingDecision = true;
    this.decisionError = '';

    this.projetSvc.postAlternativesDecision(this.projet.id, accept).subscribe({
      next: (updatedProjet) => {
        this.projet = updatedProjet;
        this.submittingDecision = false;
        this.showToast(accept ? 'Choix enregistré : Proposition d\'alternatives activée.' : 'Choix enregistré : Vos composants manquants seront pris en charge par vos soins (Non-soudé).');
        this.loadBom();
        this.loadStockStatus();
      },
      error: (err) => {
        this.submittingDecision = false;
        this.decisionError = err.error?.message || 'Erreur lors de l\'enregistrement de votre décision.';
      }
    });
  }

  /**
   * Sélection d'une alternative pour un composant
   */
  onSelectAlternative(compMpn: string, altMpn: string, supplier: string) {
    if (!this.projet) return;
    const req: BomComponentDecisionRequest = {
      componentMpnOriginal: compMpn,
      approvedMpn: altMpn,
      decisionType: 'ACCEPT_ALTERNATIVE',
      supplier: supplier
    };
    this.saveDecisions([req]);
  }

  /**
   * Sélection du mode Client Supply pour un composant
   */
  onSelectClientSupply(compMpn: string) {
    if (!this.projet) return;
    const req: BomComponentDecisionRequest = {
      componentMpnOriginal: compMpn,
      approvedMpn: compMpn,
      decisionType: 'CLIENT_SUPPLY',
      supplier: 'CLIENT',
      comment: 'Non fourni ni soudé par l\'entreprise (DNP)'
    };
    this.saveDecisions([req]);
  }

  private saveDecisions(requests: BomComponentDecisionRequest[]) {
    if (!this.projet) return;
    this.submittingDecision = true;
    this.decisionError = '';

    this.projetSvc.saveComponentDecisions(this.projet.id, requests).subscribe({
      next: (updatedBom) => {
        this.bomData = updatedBom;
        this.submittingDecision = false;
        this.showToast('Décision composant sauvegardée avec succès.');
      },
      error: (err) => {
        this.submittingDecision = false;
        this.decisionError = err.error?.message || 'Erreur lors de la sauvegarde du choix composant.';
      }
    });
  }

  /**
   * Validation finale de la BOM
   */
  onValidateFinalBom() {
    if (!this.projet) return;
    this.validatingBom = true;
    this.decisionError = '';

    this.projetSvc.validateFinalBom(this.projet.id).subscribe({
      next: (updatedProjet) => {
        this.projet = updatedProjet;
        this.validatingBom = false;
        // On emmene le client vers son prix, pas vers sa fiche projet : il
        // vient d'arbitrer ses composants un par un, c'est le moment ou la
        // question « combien ca coute » se pose, et le seul du parcours ou il
        // est pret a commander.
        // Devis instantané désactivé : retour à la fiche projet.
        if (!environment.features.instantQuote) {
          this.showToast('🎉 BOM validée et gelée.');
          setTimeout(() => {
            this.router.navigate(['/client/projets', updatedProjet.id]);
          }, 1200);
          return;
        }
        this.showToast('🎉 BOM validée et gelée. Voici votre devis...');
        setTimeout(() => {
          this.router.navigate(['/projets', updatedProjet.id, 'devis'],
                               { queryParams: { bomValidee: 1 } });
        }, 1200);
      },
      error: (err) => {
        this.validatingBom = false;
        const rawMsg: string = err.error?.message || '';
        let cleanMsg = 'Impossible de valider la BOM. Assurez-vous que tous les composants ont une décision valide.';
        
        if (rawMsg.includes('All components must have a decision') || rawMsg.includes('Missing components')) {
          cleanMsg = '⚠️ Toutes les décisions doivent être prises avant de valider la BOM. Veuillez vérifier les composants manquants dans la liste.';
        } else if (rawMsg) {
          cleanMsg = rawMsg;
        }

        this.decisionError = cleanMsg;
        this.showErrorToast(cleanMsg);
      }
    });
  }
}

