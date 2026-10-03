import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProjetService } from '../../services/projet.service';
import { AuthService } from '../../../../services';
import { Projet, ProjetStatut, ProjetUpdateRequest } from '../../models/projet.models';

@Component({
  selector: 'app-projet-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projet-list.component.html',
})
export class ProjetListComponent implements OnInit {
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);

  loading = true; error = '';
  projets: Projet[] = [];
  filteredProjets: Projet[] = [];
  activeTab: 'all' | ProjetStatut = 'all';
  userRole = 'CLIENT';
  currentView: 'list' | 'kanban' | 'timeline' = 'list';
  showAllProjects = false;

  // Edit modal
  showEditModal = false;
  saving = false; saveError = '';
  editingProjet?: Projet;
  editForm: ProjetUpdateRequest = {};

  // Delete modal
  showDeleteModal = false;
  deletingId = '';
  deleting = false;

  // Archive modal
  showArchiveModal = false;
  archivingProjet: Projet | null = null;
  archiving = false;

  // Success toast
  successMsg = '';

  ngOnInit() {
    this.userRole = this.authSvc.role || 'CLIENT';
    if (this.userRole === 'ADMINISTRATEUR') {
      this.showAllProjects = true;
    }
    this.activeTab = 'all';
    this.load();
  }

  load() {
    this.loading = true; this.error = '';
    
    let obs;
    if (this.isExternalUser()) {
      obs = this.projetSvc.getMesProjets();
    } else if (this.showAllProjects) {
      obs = this.projetSvc.getProjets(0, 100);
    } else {
      obs = this.projetSvc.getMesProjetsAssignes(0, 100);
    }

    obs.subscribe({
      next: (page) => {
        this.projets = page.content;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.error = 'Erreur de chargement des projets'; this.loading = false; }
    });
  }

  toggleAssignedFilter(showAll: boolean) {
    this.showAllProjects = showAll;
    this.load();
  }

  /**
   * L'ingenieur ne fait que regarder.
   *
   * Invite par un client entreprise, il travaille sur les projets de cette
   * societe mais rien ne lui appartient : creer, modifier ou supprimer un
   * dossier engage la societe, et c'est au client de le faire.
   */
  get lectureSeule(): boolean {
    return this.authSvc.lectureSeule;
  }

  isExternalUser(): boolean {
    // L'ingenieur en fait partie : invite par un client entreprise pour
    // travailler sur les projets de sa societe, c'est un collaborateur du
    // client, pas un collegue. ms-projet le classe deja parmi les externes ;
    // le front le traitait en interne et lui montrait l'atelier.
    return this.userRole === 'CLIENT'
        || this.userRole === 'CLIENT_ENTREPRISE'
        || this.userRole === 'INGENIEUR';
  }

  getTabsForRole() {
    switch (this.userRole) {
      case 'SUPPORT_TECHNIQUE':
        return [
          { id: 'all', label: 'Tous', icon: '📁' },
          { id: 'PENDING', label: 'En attente', icon: '🔍' },
          { id: 'QUOTED', label: 'Quoted', icon: '⏳' },
          { id: 'CONFIRMED', label: 'Confirmés', icon: '✅' },
          { id: 'IN_PROGRESS', label: 'En cours', icon: '⚙️' },
          { id: 'COMPLETED', label: 'Terminés', icon: '🚀' }
        ];
      case 'CHEF_DE_PROJET':
        return [
          { id: 'all', label: 'Tous', icon: '📁' },
          { id: 'PENDING', label: 'En attente', icon: '🔍' },
          { id: 'QUOTED', label: 'Quoted', icon: '⏳' },
          { id: 'CONFIRMED', label: 'Confirmés', icon: '✅' },
          { id: 'IN_PROGRESS', label: 'En cours', icon: '⚙️' },
          { id: 'COMPLETED', label: 'Terminés', icon: '🚀' }
        ];
      case 'ADMINISTRATEUR':
        return [
          { id: 'all', label: 'Tous', icon: '📁' },
          { id: 'PENDING', label: 'En attente', icon: '🔍' },
          { id: 'QUOTED', label: 'Quoted', icon: '⏳' },
          { id: 'CONFIRMED', label: 'Confirmés', icon: '✅' },
          { id: 'IN_PROGRESS', label: 'En cours', icon: '⚙️' },
          { id: 'COMPLETED', label: 'Terminés', icon: '🚀' },
          { id: 'ARCHIVED', label: 'Archivés', icon: '📦' },
          { id: 'CANCELLED', label: 'Annulés', icon: '❌' }
        ];
      default: // CLIENT or others
        return [
          { id: 'all', label: 'Tous', icon: '📁' },
          { id: 'BROUILLON', label: 'Brouillons', icon: '📝' },
          { id: 'PENDING', label: 'En attente', icon: '🔍' },
          { id: 'QUOTED', label: 'Quoted', icon: '⏳' },
          { id: 'CONFIRMED', label: 'Confirmés', icon: '✅' },
          { id: 'IN_PROGRESS', label: 'En cours', icon: '⚙️' },
          { id: 'COMPLETED', label: 'Terminés', icon: '🚀' },
          { id: 'ARCHIVED', label: 'Archivés', icon: '📦' },
          { id: 'CANCELLED', label: 'Annulés', icon: '❌' }
        ];
    }
  }

  getTabCount(tabId: string): number {
    if (tabId === 'all') return this.countAll;
    return this.projets.filter(p => p.statut === tabId).length;
  }

  /**
   * Ce que le champ de recherche cherche.
   *
   * Le nom du client d'abord — c'est la demande : « montre-moi les projets de
   * Ben Raslene ». Mais un interne connait aussi ses projets par leur nom, et
   * les distinguer aurait demande un second champ pour un seul mot tape. Une
   * seule barre couvre les deux, plus l'e-mail quand deux clients sont
   * homonymes.
   */
  recherche = '';

  private correspond(p: Projet): boolean {
    const q = this.recherche.trim().toLowerCase();
    if (!q) return true;
    return [p.clientNom, p.clientEmail, p.nom, p.description]
      .some(champ => !!champ && champ.toLowerCase().includes(q));
  }

  applyFilter() {
    const parStatut = this.activeTab === 'all'
      ? this.projets.filter(p => p.statut !== 'ARCHIVED')
      : this.projets.filter(p => p.statut === this.activeTab);

    this.filteredProjets = parStatut.filter(p => this.correspond(p));
  }

  /** Le champ a change : on refiltre sans rappeler le serveur. */
  onRecherche(): void {
    this.applyFilter();
  }

  effacerRecherche(): void {
    this.recherche = '';
    this.applyFilter();
  }

  /** Combien de projets la recherche ecarte — pour l'annoncer plutot que de les faire disparaitre. */
  get masquesParRecherche(): number {
    if (!this.recherche.trim()) return 0;
    const parStatut = this.activeTab === 'all'
      ? this.projets.filter(p => p.statut !== 'ARCHIVED')
      : this.projets.filter(p => p.statut === this.activeTab);
    return parStatut.length - this.filteredProjets.length;
  }

  switchTab(tab: any) {
    this.activeTab = tab;
    this.applyFilter();
  }

  switchView(view: 'list' | 'kanban' | 'timeline') {
    this.currentView = view;
  }

  get countAll(): number { return this.projets.filter(p => p.statut !== 'ARCHIVED').length; }
  get countBrouillon(): number { return this.projets.filter(p => p.statut === 'BROUILLON').length; }
  get countConsultation(): number { return this.countPending; }
  get countPending(): number { return this.projets.filter(p => p.statut === 'PENDING').length; }
  get countQuoted(): number { return this.projets.filter(p => p.statut === 'QUOTED').length; }
  get countInProgress(): number { return this.projets.filter(p => p.statut === 'IN_PROGRESS').length; }
  get countConfirmed(): number { return this.projets.filter(p => p.statut === 'CONFIRMED').length; }
  get countCompleted(): number { return this.projets.filter(p => p.statut === 'COMPLETED').length; }
  get countArchived(): number { return this.projets.filter(p => p.statut === 'ARCHIVED').length; }
  get countCancelled(): number { return this.projets.filter(p => p.statut === 'CANCELLED').length; }

  statusEmoji(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return '📝';
      case 'PENDING': return '🔍';
      case 'QUOTED': return '⏳';
      case 'CONFIRMED': return '✅';
      case 'IN_PROGRESS': return '⚙️';
      case 'COMPLETED': return '🚀';
      case 'ARCHIVED': return '📦';
      case 'CANCELLED': return '❌';
      default: return '📁';
    }
  }

  statusLabel(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return 'Brouillon';
      case 'PENDING': return 'En attente';
      case 'QUOTED': return 'Quoted';
      case 'CONFIRMED': return 'Confirmé';
      case 'IN_PROGRESS': return 'En cours';
      case 'COMPLETED': return 'Terminé';
      case 'ARCHIVED': return 'Archivé';
      case 'CANCELLED': return 'Annulé';
      default: return 'Inconnu';
    }
  }

  statusColor(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return 'hsl(var(--warning))';
      case 'PENDING': return 'hsl(var(--warning))';
      case 'QUOTED': return 'hsl(var(--primary))';
      case 'CONFIRMED': return 'hsl(var(--success))';
      case 'IN_PROGRESS': return '#6366f1';
      case 'COMPLETED': return 'hsl(var(--success))';
      case 'ARCHIVED': return 'hsl(var(--muted-foreground))';
      case 'CANCELLED': return 'hsl(var(--destructive))';
      default: return 'hsl(var(--muted))';
    }
  }

  statusBg(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return 'hsl(var(--warning)/0.1)';
      case 'PENDING': return 'hsl(var(--warning)/0.1)';
      case 'QUOTED': return 'hsl(var(--primary)/0.1)';
      case 'CONFIRMED': return 'hsl(var(--success)/0.1)';
      case 'IN_PROGRESS': return 'rgba(99, 102, 241, 0.1)';
      case 'COMPLETED': return 'hsl(var(--success)/0.1)';
      case 'ARCHIVED': return 'hsl(var(--muted-foreground)/0.1)';
      case 'CANCELLED': return 'hsl(var(--destructive)/0.1)';
      default: return 'hsl(var(--muted)/0.1)';
    }
  }

  statusDotClass(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return 'status-dot-warning';
      case 'PENDING': return 'status-dot-warning';
      case 'QUOTED': return 'status-dot-primary';
      case 'CONFIRMED': return 'status-dot-success';
      case 'IN_PROGRESS': return 'status-dot-indigo';
      case 'COMPLETED': return 'status-dot-success';
      case 'ARCHIVED': return 'status-dot-muted';
      case 'CANCELLED': return 'status-dot-destructive';
      default: return 'status-dot-muted';
    }
  }

  hasIdeaDocuments(p: Projet): boolean {
    return !!(p.documents && p.documents.length > 0);
  }

  getAssignmentStatus(p: Projet) {
    if (p.statut === 'BROUILLON') {
      return { label: 'Brouillon', bg: 'hsl(var(--warning)/0.1)', color: 'hsl(var(--warning))', border: '1px solid hsl(var(--warning)/0.3)' };
    }
    
    const hasChef = p.assignments?.some(a => a.role === 'CHEF_DE_PROJET');
    const hasSupport = p.assignments?.some(a => a.role === 'SUPPORT_TECHNIQUE');
    const hasTech = p.assignments?.some(a => a.role === 'TECHNICIEN');
    
    const totalRolesCount = (hasChef ? 1 : 0) + (hasSupport ? 1 : 0) + (hasTech ? 1 : 0);

    if (totalRolesCount === 3) {
      return { label: '🟢 Affecté', bg: 'hsl(var(--success)/0.08)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success)/0.25)' };
    } else if (totalRolesCount > 0) {
      return { label: '🟡 Partiellement affecté', bg: 'hsl(var(--primary)/0.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.25)' };
    } else {
      // Pas d'assignation du tout
      if (p.statut === 'PENDING' || p.statut === 'CONFIRMED') {
        return { label: '🔴 Non affecté', bg: 'hsl(var(--destructive)/0.08)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive)/0.25)' };
      }
      // Pour les autres états (QUOTED, ARCHIVED, CANCELLED, IN_PROGRESS...), pas besoin d'afficher "Non affecté"
      return { label: '', bg: 'transparent', color: 'transparent', border: 'none' };
    }
  }

  isPcbOnly(p: Projet): boolean {
    if (!p || !p.cadrage?.manufacturingNeeds) return false;
    if (p.cadrage.objectif !== 'PROTOTYPE') return false;
    const mfg = p.cadrage.manufacturingNeeds;
    return mfg.includes('PCB_FAB') && !mfg.includes('SMT_ASSEMBLY') && !mfg.includes('PROTOTYPE_ASSEMBLY');
  }

  hasPickAndPlace(p: Projet): boolean {
    if (!p) return false;
    const docs = p.documents || [];
    return docs.some(d => {
      const typeStr = String(d.typeDocument || '').toUpperCase();
      const nameStr = String(d.nomDocument || '').toLowerCase();
      const urlStr = String(d.fileUrl || '').toLowerCase();
      return typeStr === 'PICK_AND_PLACE' || nameStr.includes('cpl') || nameStr.includes('centroid') || nameStr.includes('pick') || urlStr.includes('cpl');
    });
  }

  hasSop(p: Projet): boolean {
    if (!p) return false;
    const docs = p.documents || [];
    return docs.some(d => {
      const typeStr = String(d.typeDocument || '').toUpperCase();
      const nameStr = String(d.nomDocument || '').toLowerCase();
      const urlStr = String(d.fileUrl || '').toLowerCase();
      return typeStr === 'SOP' || nameStr.includes('sop') || urlStr.includes('sop');
    });
  }

  isPackageComplete(p: Projet): boolean {
    if (!p) return false;
    // Les phases IDÉE, FAISABILITÉ ou VALIDATION ne requièrent pas de package PCB complet
    if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE' || p.cadrage?.objectif === 'VALIDATION') {
      return true;
    }
    const gerber = this.hasGerber(p);
    if (!gerber) return false;

    // En Prototype et Production PCBA (non pcb-only), Pick & Place et SOP sont obligatoires
    if (!this.isPcbOnly(p) && (p.cadrage?.objectif === 'PROTOTYPE' || p.cadrage?.objectif === 'PRODUCTION')) {
      return this.hasPickAndPlace(p) && this.hasSop(p);
    }
    return true;
  }

  hasAnyPackageFile(p: Projet): boolean {
    if (!p) return false;
    const docs = p.documents || [];
    return docs.some(d => ['GERBER', 'PICK_AND_PLACE', 'SOP', 'DRILL_FILE', 'DIAGRAMME'].includes(String(d.typeDocument || '').toUpperCase()));
  }

  hasGerber(p: Projet): boolean {
    if (!p) return false;
    const docs = p.documents || [];
    const techDocs = p.fichiersTechniques || [];

    const hasGerberDoc = docs.some(d => {
      const typeStr = String(d.typeDocument || '').toUpperCase();
      const nameStr = String(d.nomDocument || '').toLowerCase();
      const urlStr = String(d.fileUrl || '').toLowerCase();
      return typeStr === 'GERBER' || nameStr.includes('gerber') || urlStr.includes('gerber')
        || nameStr.endsWith('.zip') || nameStr.endsWith('.rar') || nameStr.endsWith('.7z')
        || urlStr.endsWith('.zip') || urlStr.endsWith('.rar') || urlStr.endsWith('.7z');
    });

    const hasGerberTech = techDocs.some(f => {
      const s = String(f).toLowerCase();
      return s.includes('gerber') || s.endsWith('.zip') || s.endsWith('.rar') || s.endsWith('.7z');
    });

    return hasGerberDoc || hasGerberTech;
  }

  hasBom(p: Projet): boolean {
    if (p.bomUploaded) return true;
    const docs = p.documents || [];
    return docs.some(d => {
      const typeStr = String(d.typeDocument || '').toUpperCase();
      if (typeStr === 'BOM') return true;
      if (typeStr === 'SOP' || typeStr === 'PICK_AND_PLACE' || typeStr === 'GERBER' || typeStr === 'DRILL_FILE') return false;
      const nameStr = String(d.nomDocument || d.fileUrl || '').toLowerCase();
      return nameStr.endsWith('.xlsx') || nameStr.endsWith('.xls') || nameStr.endsWith('.csv');
    });
  }

  /** Show primary action button for client projects */
  needsCadrage(p: Projet): boolean {
    return p.statut === 'BROUILLON' || p.statut === 'QUOTED';
  }

  getCadrageActionRoute(p: Projet): string {
    const isPcb = this.isPcbOnly(p);
    const bom = this.hasBom(p);

    // Les projets Idée et Faisabilité sont cadrés par définition (redirection directe vers la fiche projet)
    if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') {
      return '/client/projets/' + p.id;
    }

    if (!p.cadrage || !p.cadrage.timeline) {
      return '/client/projets/' + p.id + '/cadrage';
    }

    // Pour la phase VALIDATION, la BOM est obligatoire mais pas le Gerber
    if (p.cadrage?.objectif === 'VALIDATION') {
      return bom ? '/client/projets/' + p.id : '/client/projets/' + p.id + '/bom';
    }

    // Si le package de fichiers de fabrication n'est pas encore complet -> renvoyer vers upload-gerber !
    if (!this.isPackageComplete(p)) {
      return '/client/projets/' + p.id + '/upload-gerber';
    }

    // Si package complet mais BOM manquante (pour les projets avec assemblage PCBA)
    if (!isPcb && !bom) {
      return '/client/projets/' + p.id + '/bom';
    }

    return '/client/projets/' + p.id;
  }

  getCadrageActionLabel(p: Projet): string {
    const isPcb = this.isPcbOnly(p);
    const bom = this.hasBom(p);

    // Les projets Idée et Faisabilité ont l'action principale Voir le projet ou Déposer fichier
    if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') {
      return (!p.documents || p.documents.length === 0) ? 'Déposer fichier' : 'Voir le projet';
    }

    if (!p.cadrage || !p.cadrage.timeline) {
      return 'Continuer le cadrage';
    }

    if (p.cadrage?.objectif === 'VALIDATION') {
      return bom ? 'Voir le projet' : 'Importer la BOM';
    }

    // Si le package de fichiers n'est pas encore complet
    if (!this.isPackageComplete(p)) {
      if (this.hasAnyPackageFile(p)) {
        return '📁 Compléter les fichiers';
      }
      return isPcb ? 'Téléverser le Gerber' : 'Configurer les fichiers PCB';
    }

    // Si package complet mais BOM manquante
    if (!isPcb && !bom) {
      return 'Importer la BOM';
    }

    return 'Voir le projet';
  }

  projectProgress(p: Projet): number {
    if (p.statut !== 'BROUILLON') return 100;
    if (!p.cadrage) return 10;

    let progress = 10;
    if (p.cadrage.industrie) progress = 20;
    if (p.cadrage.objectif) progress = 40;

    const hasNeeds = (p.cadrage.hardwareNeeds && p.cadrage.hardwareNeeds.length > 0) ||
                     (p.cadrage.firmwareNeeds && p.cadrage.firmwareNeeds.length > 0) ||
                     (p.cadrage.manufacturingNeeds && p.cadrage.manufacturingNeeds.length > 0);
    if (hasNeeds) progress = 60;
    if (p.cadrage.engagementModel) progress = 80;
    if (p.cadrage.timeline) progress = 100;
    return progress;
  }

  getProjectInitials(nom: string): string {
    if (!nom) return 'PR';
    const parts = nom.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nom.slice(0, 2).toUpperCase();
  }

  getAvatarStyle(nom: string): { [key: string]: string } {
    if (!nom) return { 
      'background': 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))', 
      'color': '#3b82f6', 
      'border': '1px solid rgba(59, 130, 246, 0.25)' 
    };
    
    const hash = nom.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const index = hash % 4;
    
    switch (index) {
      case 0:
        return {
          'background': 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))',
          'color': '#3b82f6',
          'border': '1px solid rgba(59, 130, 246, 0.25)'
        };
      case 1:
        return {
          'background': 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05))',
          'color': '#10b981',
          'border': '1px solid rgba(16, 185, 129, 0.25)'
        };
      case 2:
        return {
          'background': 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.05))',
          'color': '#6366f1',
          'border': '1px solid rgba(99, 102, 241, 0.25)'
        };
      default:
        return {
          'background': 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.05))',
          'color': '#f59e0b',
          'border': '1px solid rgba(245, 158, 11, 0.25)'
        };
    }
  }

  getProjectProgressLabel(p: Projet): string {
    if (p.statut === 'CONFIRMED') return 'Projet Actif';
    if (p.statut === 'IN_PROGRESS') return 'En cours';
    if (p.statut === 'QUOTED') return 'En attente de paiement';
    if (p.statut === 'PENDING') return 'Consultation en cours';
    if (p.statut === 'COMPLETED') return 'Livraison Terminée';
    if (p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') {
      return 'Consultation en cours';
    }

    if (p.statut === 'CANCELLED') return 'Projet Annulé';
    if (p.statut === 'ARCHIVED') return 'Archivé';
    if (p.statut === 'BROUILLON') return 'Étape 1/5 • Industrie';
    
    if (!p.cadrage) return 'Étape 1/5 • Définition';
    
    if (p.cadrage.timeline) return 'Étape 5/5 • Chronologie';
    if (p.cadrage.engagementModel) return 'Étape 4/5 • Modèle';
    
    const hasNeeds = (p.cadrage.hardwareNeeds && p.cadrage.hardwareNeeds.length > 0) ||
                     (p.cadrage.firmwareNeeds && p.cadrage.firmwareNeeds.length > 0) ||
                     (p.cadrage.manufacturingNeeds && p.cadrage.manufacturingNeeds.length > 0);
    if (hasNeeds) return 'Étape 3/5 • Besoins';
    if (p.cadrage.objectif) return 'Étape 2/5 • Objectif';
    return 'Étape 1/5 • Industrie';
  }


  // Edit
  openEdit(p: Projet) {
    this.editingProjet = p;
    this.saveError = '';
    this.editForm = { nom: p.nom, description: p.description, statut: p.statut };
    this.showEditModal = true;
  }

  closeModal() { this.showEditModal = false; this.showDeleteModal = false; }

  saveEdit() {
    if (!this.editingProjet) return;
    this.saving = true; this.saveError = '';
    this.projetSvc.update(this.editingProjet.id, this.editForm).subscribe({
      next: () => {
        this.saving = false; this.showEditModal = false;
        this.showToast('Projet modifié avec succès !');
        this.load();
      },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur lors de la modification'; }
    });
  }

  // Delete
  /**
   * Supprimer n'est pas annuler : la ligne disparait au lieu de rester avec
   * un statut.
   *
   * Des QUOTED, un devis vit dans la facturation, puis un contrat, une
   * facture, un paiement, tous accroches a ce projetId. Effacer la ligne les
   * laisserait pointer vers un projet introuvable. A partir de la, un projet
   * s'annule ; avant, il n'y a rien a preserver.
   */
  supprimable(p: Projet): boolean {
    return p.statut === 'BROUILLON' || p.statut === 'PENDING';
  }

  confirmDelete(id: string) { this.deletingId = id; this.showDeleteModal = true; }
  cancelDelete() { this.showDeleteModal = false; this.deletingId = ''; }

  doDelete() {
    this.deleting = true;
    this.projetSvc.delete(this.deletingId).subscribe({
      next: () => {
        this.deleting = false; this.showDeleteModal = false;
        this.showToast('Projet supprimé');
        this.load();
      },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }

  // Archive
  confirmArchive(p: Projet) {
    this.archivingProjet = p;
    this.showArchiveModal = true;
  }

  cancelArchive() {
    this.showArchiveModal = false;
    this.archivingProjet = null;
  }

  doArchive() {
    if (!this.archivingProjet) return;
    this.archiving = true;
    this.projetSvc.archive(this.archivingProjet.id).subscribe({
      next: () => {
        this.archiving = false;
        this.showArchiveModal = false;
        this.showToast('Projet archivé avec succès !');
        this.load();
      },
      error: () => {
        this.archiving = false;
        this.showArchiveModal = false;
      }
    });
  }

  getProjetsByStatut(statut: ProjetStatut): Projet[] {
    return this.filteredProjets.filter(p => p.statut === statut);
  }

  showToast(msg: string) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 4000);
  }
}
