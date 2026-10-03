import { BillingService } from '../../../billing/services/billing.service';
import { aGerber, aPickAndPlace, aSop, aBom } from '../../utils/fichiers-techniques';
import { Contract, Invoice } from '../../../billing/models/billing.models';
import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription, interval } from 'rxjs';
import { ProjetService } from '../../services/projet.service';
import { AuthService, ProfileService, AdminUserService } from '../../../../services';
import { Projet, ProjetUpdateRequest, ProjetStatut, ProjectStage, TypeDocumentProjet, DocumentProjet, ProjectAssignRequest, AssignmentHistoryResponse, BomComponent, StockCheckComponent, ProjectStockStatusResponse, BomResponse, PhaseArchive } from '../../models/projet.models';
import { User } from '../../../user/models/user.models';
import { TicketService } from '../../../ticket/services/ticket.service';
import { Ticket, Message } from '../../../ticket/models/ticket.models';
import { ReunionService } from '../../services/reunion.service';
import { Reunion } from '../../models/reunion.models';
import { MeetingSchedulerModalComponent } from '../../components/meeting-scheduler-modal.component';
import { MeetingRoomModalComponent } from '../../components/meeting-room-modal.component';
import { InstantQuotePanelComponent } from '../../../billing/components/instant-quote-panel/instant-quote-panel.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-projet-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MeetingSchedulerModalComponent, MeetingRoomModalComponent, InstantQuotePanelComponent],
  templateUrl: './projet-detail.component.html',
})
export class ProjetDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private projetSvc   = inject(ProjetService);
  private authSvc     = inject(AuthService);
  private profileSvc  = inject(ProfileService);
  private adminSvc    = inject(AdminUserService);
  private ticketSvc   = inject(TicketService);
  private billingSvc = inject(BillingService);
  private sanitizer = inject(DomSanitizer);
  private reunionSvc = inject(ReunionService);
  previewSignedContractUrl: SafeResourceUrl | null = null;
  previewingSignedContract = false;
  projectContract: Contract | null = null;
  projectInvoices: Invoice[] = [];
  issuingTranche2 = false;


  loading = true; error = '';
  projet?: Projet;
  userRole = 'CLIENT';
  client: User | null = null;

  // BOM & Stock states
  checkingStock = false;
  stockCheckError = '';
  stockDetails: ProjectStockStatusResponse | null = null;

  // Edit modal
  showEditModal = false;
  saving = false; saveError = '';
  editForm: ProjetUpdateRequest = {};

  // Delete modal
  showDeleteModal = false;
  deleting = false;

  // Status change modal
  showStatusModal = false;
  changingStatus = false;
  nextStatus: ProjetStatut = 'CONFIRMED';

  // Success toast
  successMsg = '';

  // ── Assignment ──
  showAssignModal = false;
  assignRole: 'CHEF_DE_PROJET' | 'SUPPORT_TECHNIQUE' | 'TECHNICIEN' = 'CHEF_DE_PROJET';
  staffList: (User & { projectCount?: number })[] = [];
  loadingStaff = false;
  selectedStaffId = '';
  assigning = false;
  assignError = '';
  assignedUsers: { [role: string]: User[] } = {};

  // Assignment history
  assignmentHistory: any[] = [];
  loadingHistory = false;
  showHistoryModal = false;

  // File upload & validation logic for PM/Support
  selectedFiles: File[] = [];
  uploadingFiles = false;
  uploadError = '';
  validatingFiles = false;

  // Premium Confirmation Modals State
  showDeleteFileModal = false;
  fileToDeleteUrl = '';
  fileToDeleteName = '';
  showValidationModal = false;
  showProductionModal = false;

  // ── Chat intégré au Projet ──
  @ViewChild('chatWindow') private chatWindow!: ElementRef;
  linkedTicket: Ticket | null = null;
  chatMessages: Message[] = [];
  newChatMessage = '';
  sendingMessage = false;
  loadingChat = false;
  chatError = '';
  private chatPollSub: Subscription | null = null;
  private shouldScrollChat = false;

  // ── Fichiers internes (Support) ──
  selectedInternalFiles: File[] = [];
  uploadingInternalFiles = false;
  uploadInternalError = '';
  finalizingSupport = false;
  finalizeError = '';


  // ── Réunions ──
  projectReunions: Reunion[] = [];
  loadingReunions = false;
  showSchedulerModal = false;
  showMeetingRoomModal = false;
  showAvailabilityModal = false;
  activeReunion: Reunion | null = null;
  cancellingReunionId = '';
  showCancelReunionConfirm = false;
  reunionToCancelId = '';
  cancelMotif = '';
  cancelling = false;

  private cdr = inject(ChangeDetectorRef);
  private pollSub?: Subscription;

  ngOnInit() {
    this.userRole = this.authSvc.role || 'CLIENT';
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadProjet(id);
    this.loadProjectReunions(id);

    // Auto-poll project and billing contract every 3 seconds for real-time stepper & status progression
    this.pollSub = interval(3000).subscribe(() => {
      if (this.projet && !this.loading) {
        this.projetSvc.getProjet(id).subscribe({
          next: (updated) => {
            this.projet = updated;
            this.cdr.markForCheck();
          }
        });
        this.loadBillingData(id);
      }
    });
  }

  ngOnDestroy() {
    if (this.chatPollSub) {
      this.chatPollSub.unsubscribe();
    }
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollChat && this.chatWindow) {
      try {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      } catch (e) {}
      this.shouldScrollChat = false;
    }
  }

  loadProjet(id: string) {
    this.loading = true;
    this.projetSvc.getProjet(id).subscribe({
      next: (p) => {
        if (this.userRole === 'SUPPORT_TECHNIQUE' && p.statut !== 'PENDING') {
          // Allow access if support is assigned to this project
          const isAssigned = p.assignments?.some(a => a.userId === this.authSvc.currentUser?.id) || false;
          if (!isAssigned) {
            this.error = 'Accès interdit : vous n\'avez pas accès à ce projet.';
            this.loading = false;
            return;
          }
        }
        this.projet = p;
        this.loading = false;
        this.loadBillingData(p.id);

        if (this.hasBomDocument()) {
          this.loadStockStatus();
        }

        // Modal automatique d'upload d'idée / faisabilité à chaque visite tant qu'aucun document n'est présent
        if ((p.cadrage?.objectif === 'IDEE' || p.cadrage?.objectif === 'FAISABILITE') &&
            (!p.documents || p.documents.length === 0) &&
            this.isExternalUser()) {
          this.showIdeaUploadModal = true;
        } else {
          this.showIdeaUploadModal = false;
        }

        // L'etat de la discussion, pour tous les objectifs.
        //
        // Elle n'existait que la ou une consultation etait ouverte
        // automatiquement — idee, faisabilite, validation. Un prototype ou une
        // serie n'en avaient aucune, et le client se rabattait sur une
        // reclamation, qui n'est pas faite pour poser une question.
        this.loadLinkedTicketChat(p.id);

        if (!this.isExternalUser() && p.userId) {
          this.profileSvc.getUserById(p.userId).subscribe({
            next: (u) => { this.client = u; },
            error: (err) => console.error('Erreur chargement client', err)
          });
        }

        this.assignedUsers = {};
        if (p.assignments) {
          p.assignments.forEach(a => {
            if (!this.assignedUsers[a.role]) {
              this.assignedUsers[a.role] = [];
            }
            this.profileSvc.getUserById(a.userId).subscribe({
              next: (u) => {
                if (!this.assignedUsers[a.role].some(existing => existing.id === u.id)) {
                  this.assignedUsers[a.role].push(u);
                }
              },
              error: (err) => console.error('Erreur chargement profil assignation', err)
            });
          });
        }
      },
      error: () => { this.error = 'Projet introuvable'; this.loading = false; }
    });
  }

  getClientInitials(): string {
    if (!this.client) return 'CL';
    const p = this.client.prenom?.[0] || '';
    const n = this.client.nom?.[0] || '';
    return (p + n).toUpperCase() || 'CL';
  }

  // ── Discussion du projet ──────────────────────────────────────────
  //
  // Le fil est un ticket de type CONSULTATION rattache au projet. Il n'existe
  // que si quelqu'un l'a ouvert : creer un fil pour chaque projet remplirait
  // la liste du support de conversations que personne n'a commencees.

  ouvertureDiscussion = false;
  erreurDiscussion = '';

  /** Qui repond au client : le support affecte, sinon le chef de projet. */
  get interlocuteurDiscussion(): string | null {
    const support = this.getAssignments('SUPPORT_TECHNIQUE')[0];
    if (support?.userNom) return support.userNom + ' · Support technique';
    const cdp = this.getAssignments('CHEF_DE_PROJET')[0];
    if (cdp?.userNom) return cdp.userNom + ' · Chef de projet';
    return null;
  }

  /**
   * La conversation existe des que le projet existe — pour ceux qui en font
   * partie.
   *
   * Cote client, toujours : c'est son projet, il doit pouvoir poser sa
   * question sans attendre qu'on lui affecte quelqu'un.
   *
   * Cote equipe, seulement une fois affecte. Le bouton restait actif pour un
   * chef de projet qui passait sur une fiche qui n'etait pas la sienne : il
   * cliquait, et arrivait sur un refus. Mieux vaut qu'il voie tout de suite
   * qu'il lui manque l'affectation.
   */
  get discussionDisponible(): boolean {
    return this.isExternalUser() || this.isAssignedToProject;
  }

  /** Depuis quand le dernier message attend — en clair. */
  get dernierMessageLe(): string | null {
    const dernier = this.chatMessages[this.chatMessages.length - 1];
    if (!dernier?.createdAt) return null;
    const ms = Date.now() - new Date(dernier.createdAt).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "a l'instant";
    if (minutes < 60) return 'il y a ' + minutes + ' min';
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return 'il y a ' + heures + ' h';
    return 'il y a ' + Math.floor(heures / 24) + ' j';
  }

  /**
   * Ouvre le fil — et le cree s'il n'existe pas encore.
   *
   * Le meme geste sert les deux cas : le bouton ne sait pas si la discussion
   * a deja ete entamee, et n'a pas a le savoir.
   */
  ouvrirDiscussion(): void {
    if (!this.projet) return;
    // La conversation d'un projet n'a pas a etre ouverte : elle existe des
    // que le projet existe. On y va, c'est tout.
    this.router.navigate([
      this.isExternalUser() ? '/client/discussions' : '/support/discussions',
      this.projet.id
    ]);
  }

  /**
   * L'ingenieur ne fait que regarder.
   *
   * Invite par un client entreprise, il travaille sur les projets de cette
   * societe mais rien ne lui appartient : deposer un fichier, faire avancer
   * une phase ou demander un devis engage la societe, et c'est au client de
   * le faire.
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

  /**
   * Le devis instantane ne vaut que pour les projets qui fabriquent vraiment
   * des cartes. Un projet d'idee ou de faisabilite passe par un devis redige
   * a la main par un chef de projet.
   */
  canGetInstantQuote(): boolean {
    if (!environment.features.instantQuote) return false;
    if (this.lectureSeule) return false;
    const objectif = this.projet?.cadrage?.objectif;
    return objectif === 'PROTOTYPE' || objectif === 'PRODUCTION';
  }

  isChefDeProjetOrAdmin(): boolean {
    return this.userRole === 'CHEF_DE_PROJET' || this.userRole === 'ADMINISTRATEUR' || this.userRole === 'ADMIN';
  }

  isAssignedChefDeProjet(): boolean {
    if (this.userRole === 'ADMINISTRATEUR' || this.userRole === 'ADMIN') return true;
    if (this.userRole !== 'CHEF_DE_PROJET') return false;
    if (!this.projet || !this.projet.assignments) return false;
    const currentUserId = this.authSvc.userId || this.authSvc.currentUser?.id;
    return this.projet.assignments.some(a => a.role === 'CHEF_DE_PROJET' && a.userId === currentUserId);
  }

  isSupportQualificationCompleted(): boolean {
    if (!this.projet) return false;
    if (this.projet.cadrage && (this.projet.cadrage.objectif === 'IDEE' || this.projet.cadrage.objectif === 'FAISABILITE')) {
      const stage = this.projet.stage;
      if (stage === 'EN_ATTENTE_CONTACT_SUPPORT' || stage === 'EN_COURS_ANALYSE') {
        return false;
      }
    }
    return true;
  }

  get projectProgress(): number {
    if (!this.projet) return 0;
    if (this.projet.statut === 'COMPLETED') return 100;
    if (this.projet.statut === 'IN_PROGRESS') return 90;
    if (this.projet.statut === 'CONFIRMED') return 80;
    if (this.projet.statut === 'QUOTED') return 60;
    if (this.projet.statut === 'PENDING') return 35;
    if (this.projet.statut === 'CANCELLED' || this.projet.statut === 'ARCHIVED') return 0;
    
    // BROUILLON progression calculation
    let progress = 10;
    if (!this.projet.cadrage) return progress;
    if (this.projet.cadrage.industrie) progress += 15;
    if (this.projet.cadrage.objectif) progress += 15;
    const hasNeeds = (this.projet.cadrage.hardwareNeeds && this.projet.cadrage.hardwareNeeds.length > 0) ||
                     (this.projet.cadrage.firmwareNeeds && this.projet.cadrage.firmwareNeeds.length > 0) ||
                     (this.projet.cadrage.manufacturingNeeds && this.projet.cadrage.manufacturingNeeds.length > 0);
    if (hasNeeds) progress += 20;
    if (this.projet.cadrage.engagementModel) progress += 20;
    if (this.projet.cadrage.timeline) progress += 20;
    return Math.min(progress, 100);
  }


  get projectManager(): { name: string; role: string; email: string; phone: string; initials: string } {
    // 1. Check if a real user profile has been loaded specifically for SUPPORT_TECHNIQUE
    const supportUser = this.assignedUsers['SUPPORT_TECHNIQUE'] && this.assignedUsers['SUPPORT_TECHNIQUE'][0];

    if (supportUser) {
      const prenom = supportUser.prenom || '';
      const nom = supportUser.nom || '';
      const fullName = `${prenom} ${nom}`.trim() || supportUser.email;
      const initials = ((prenom[0] || '') + (nom[0] || '')).toUpperCase() || 'ST';

      return {
        name: fullName,
        role: 'Support Technique',
        email: supportUser.email || '',
        phone: supportUser.telephone || '',
        initials: initials
      };
    }

    // 2. Fallback to assignment DTO if user profile request is still pending
    const assignment = this.projet?.assignments?.find(a => a.role === 'SUPPORT_TECHNIQUE');

    if (assignment) {
      const name = assignment.userNom || 'Support Technique';
      const parts = name.trim().split(/\s+/);
      const initials = (parts.length >= 2 ? (parts[0][0] + parts[1][0]) : parts[0].substring(0, 2)).toUpperCase();
      return {
        name: name,
        role: 'Support Technique',
        email: 'support@pcb-cubeit.com',
        phone: '',
        initials: initials || 'ST'
      };
    }

    // 3. Fallback if no SUPPORT_TECHNIQUE member assigned yet
    return {
      name: 'En attente d\'attribution',
      role: 'Support Technique PCB-CubeIT',
      email: 'support@pcb-cubeit.com',
      phone: '',
      initials: 'ST'
    };
  }

  get projectDocuments(): { name: string; size: string; type: string; url: string }[] {
    if (!this.projet) return [];
    const docs = [];
    if (this.projet.cadrage?.industrie) {
      docs.push({
        name: `Cahier_des_charges_${this.projet.nom.replace(/\s+/g, '_')}.pdf`,
        size: '1.2 Mo',
        type: 'PDF',
        url: '#'
      });
    }
    if (['QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(this.projet.statut)) {
      docs.push({
        name: `Devis_Technique_Commercial_${this.projet.id.substring(0, 6)}.pdf`,
        size: '850 Ko',
        type: 'PDF',
        url: '#'
      });
    }
    if (this.projet.statut === 'COMPLETED') {
      docs.push({
        name: `Rapport_de_Recette_et_Livraison.pdf`,
        size: '2.4 Mo',
        type: 'PDF',
        url: '#'
      });
    }
    return docs;
  }

  // ── Status helpers (8 statuts lifecycle) ──
  statusEmoji(s: ProjetStatut): string {
    switch (s) {
      case 'BROUILLON': return '📝'; case 'PENDING': return '🔍';
      case 'QUOTED': return '⏳'; case 'CONFIRMED': return '✅';
      case 'IN_PROGRESS': return '⚙️'; case 'COMPLETED': return '🚀';
      case 'ARCHIVED': return '📦'; case 'CANCELLED': return '❌';
      default: return '📁';
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

  get needsCadrage(): boolean {
    return !!this.projet && this.projet.statut === 'BROUILLON';
  }

  get hasCadrage(): boolean {
    return !!this.projet?.cadrage?.industrie;
  }

  /** Cadrage summary labels */
  industrieLabel(v: string): string {
    const map: Record<string, string> = {
      IOT: '🌐 IoT & Objets Connectés',
      AUTOMOTIVE: '🚗 Automobile & Mobilité',
      INDUSTRIAL: '🏭 Industrie & Automatismes',
      SMART_INFRASTRUCTURE: '🏢 Infrastructures Intelligentes',
      ENERGY: '⚡ Énergie & Cleantech',
      LOGISTICS: '🚚 Logistique & Transport',
      CONSUMER_ELECTRONICS: '📱 Électronique Grand Public',
      MEDICAL_SPECIALIZED: '🏥 Médical & Hautes Exigences'
    };
    return map[v] || v;
  }
  objectifLabel(v: string): string {
    const map: Record<string, string> = {
      IDEE: '💡 Idée', FAISABILITE: '🔍 Faisabilité', PROTOTYPE: '🔧 Prototype',
      VALIDATION: '✅ Validation', PRODUCTION: '🏭 Production'
    };
    return map[v] || v;
  }
  engagementLabel(v: string): string {
    const map: Record<string, string> = {
      ADVISORY: '💬 Conseil & Expertise',
      ASSISTED_ENGINEERING: '🤝 Ingénierie Conjointe',
      TURNKEY: '🔑 Clé en Main (Turnkey)',
      MANUFACTURING_ONLY: '🏭 Fabrication Seule',
      LONG_TERM_PARTNERSHIP: '🔄 Partenariat Long Terme'
    };
    return map[v] || v;
  }
  timelineLabel(v: string): string {
    const map: Record<string, string> = {
      URGENT: '🔴 Urgent', ONE_TO_THREE_MONTHS: '🟡 1–3 mois',
      THREE_TO_SIX_MONTHS: '🟢 3–6 mois', SIX_PLUS_MONTHS: '🔵 6+ mois'
    };
    return map[v] || v;
  }
  needLabel(v: string): string {
    return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Annulation ────────────────────────────────────────────────────
  //
  // Un projet ne s'annule que si le travail n'a pas commence. Pour une
  // fabrication, le serveur lit le journal du stock et repond dans la
  // seconde ; pour une etude, il n'a rien a lire — la demande part au chef
  // de projet, seul a savoir s'il a passe six heures dessus.
  //
  // L'ecran ne tranche rien : il pose la question et affiche la reponse.

  showAnnulationModal = false;
  motifAnnulation = '';
  annulationEnCours = false;
  erreurAnnulation = '';

  showDecisionModal = false;
  decision: 'ACCEPTER' | 'REFUSER' = 'ACCEPTER';
  motifDecision = '';
  decisionEnCours = false;
  erreurDecision = '';

  /**
   * Le client peut demander l'annulation d'un projet regle et en cours.
   * Avant le reglement, il n'y a rien a annuler : il supprime.
   */
  peutDemanderAnnulation(): boolean {
    if (!this.projet || !this.isExternalUser() || this.lectureSeule) return false;
    if (this.projet.annulationDemandee) return false;
    return this.projet.statut === 'CONFIRMED' || this.projet.statut === 'IN_PROGRESS';
  }

  /** Une demande attend une reponse, et c'est a nous de la donner. */
  peutDeciderAnnulation(): boolean {
    return !!this.projet?.annulationDemandee && this.isAssignedChefDeProjet();
  }

  /**
   * L'equipe arrete le projet d'elle-meme : une etude qui aboutit a « ce
   * n'est pas realisable ». Une fabrication engage des composants sortis et
   * un reglement encaisse — cet arbitrage revient a l'administration, et le
   * serveur le refusera de toute facon.
   */
  /**
   * Un seul geste d'arret cote equipe.
   *
   * « Abandonner l'etude » posait le meme CANCELLED et le meme stage
   * ABANDONNE que l'annulation — sans motif, sans rendre les composants et
   * sans prevenir le client. Deux boutons rouges cote a cote pour la meme
   * decision, dont le plus court perdait le plus de choses.
   */
  peutAnnulerDirectement(): boolean {
    if (!this.projet || this.isExternalUser()) return false;
    if (this.projet.statut === 'CANCELLED' || this.projet.statut === 'ARCHIVED'
        || this.projet.statut === 'COMPLETED') return false;
    // Projet réglé : l'équipe ne l'annule plus d'office. Elle répond à la
    // demande du client — le bloc « Demande d'annulation » s'affiche alors,
    // avec Accepter et Refuser. Garder ce bouton ici offrait un second
    // chemin, celui qui ne vérifie ni la fabrication ni le remboursement.
    if (this.projet.statut === 'CONFIRMED' || this.projet.statut === 'IN_PROGRESS') return false;
    const objectif = this.projet.cadrage?.objectif;
    const fabrication = objectif === 'PROTOTYPE' || objectif === 'PRODUCTION';
    if (fabrication) {
      return this.userRole === 'ADMINISTRATEUR' || this.userRole === 'ADMIN';
    }
    return this.isAssignedChefDeProjet();
  }

  ouvrirAnnulation() {
    this.motifAnnulation = '';
    this.erreurAnnulation = '';
    this.showAnnulationModal = true;
  }

  fermerAnnulation() {
    this.showAnnulationModal = false;
    this.erreurAnnulation = '';
  }

  confirmerAnnulation() {
    if (!this.projet || !this.motifAnnulation.trim()) return;
    this.annulationEnCours = true;
    this.erreurAnnulation = '';

    // Le client demande ; l'equipe prononce. Deux gestes, deux routes.
    const obs = this.isExternalUser()
      ? this.projetSvc.demanderAnnulation(this.projet.id, this.motifAnnulation.trim())
      : this.projetSvc.cancel(this.projet.id, this.motifAnnulation.trim());

    obs.subscribe({
      next: (updated) => {
        this.projet = updated;
        this.annulationEnCours = false;
        this.showAnnulationModal = false;
        this.showToast(updated.statut === 'CANCELLED'
          ? 'Projet annule.'
          : 'Demande envoyee — notre equipe revient vers vous.');
      },
      error: (e) => {
        this.annulationEnCours = false;
        // Le message du serveur dit pourquoi — « la fabrication a commence »
        // se lit mieux qu'un « erreur » generique.
        this.erreurAnnulation = e.error?.message || "L'annulation a ete refusee.";
      }
    });
  }

  ouvrirDecision(choix: 'ACCEPTER' | 'REFUSER') {
    this.decision = choix;
    this.motifDecision = '';
    this.erreurDecision = '';
    this.showDecisionModal = true;
  }

  fermerDecision() {
    this.showDecisionModal = false;
    this.erreurDecision = '';
  }

  confirmerDecision() {
    if (!this.projet) return;
    if (this.decision === 'REFUSER' && !this.motifDecision.trim()) return;

    this.decisionEnCours = true;
    this.erreurDecision = '';

    const obs = this.decision === 'ACCEPTER'
      ? this.projetSvc.accepterAnnulation(this.projet.id)
      : this.projetSvc.refuserAnnulation(this.projet.id, this.motifDecision.trim());

    obs.subscribe({
      next: (updated) => {
        this.projet = updated;
        this.decisionEnCours = false;
        this.showDecisionModal = false;
        this.showToast(this.decision === 'ACCEPTER'
          ? 'Projet annule, le client est prevenu.'
          : 'Demande refusee, le client est prevenu.');
      },
      error: (e) => {
        this.decisionEnCours = false;
        this.erreurDecision = e.error?.message || 'La decision a ete refusee.';
      }
    });
  }


  // Edit
  openEdit() {
    if (!this.projet) return;
    this.saveError = '';
    this.editForm = { 
      nom: this.projet.nom, 
      description: this.projet.description
    };
    this.showEditModal = true;
  }

  closeEdit() { this.showEditModal = false; }

  saveEdit() {
    if (!this.projet) return;
    this.saving = true; this.saveError = '';
    this.projetSvc.update(this.projet.id, this.editForm).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showEditModal = false;
        this.showToast('Projet modifié avec succès !');
      },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur'; }
    });
  }



  cancelStatusChange() { this.showStatusModal = false; }

  doStatusChange() {
    if (!this.projet) return;
    this.changingStatus = true;
    
    // L'annulation a sa propre route : elle demande un motif, et pour un
    // client elle n'annule rien — elle pose une question.
    const obs = this.projetSvc.archive(this.projet.id);

    obs.subscribe({
      next: (updated) => {
        this.projet = updated;
        this.changingStatus = false;
        this.showStatusModal = false;
        this.showToast(`Projet passé en ${this.statusLabel(updated.statut)}`);
      },
      error: () => { this.changingStatus = false; this.showStatusModal = false; }
    });
  }

  // Delete
  openDelete() { this.showDeleteModal = true; }
  cancelDelete() { this.showDeleteModal = false; }

  doDelete() {
    if (!this.projet) return;
    this.deleting = true;
    this.projetSvc.delete(this.projet.id).subscribe({
      next: () => {
        this.deleting = false;
        this.router.navigate(['/client/projets']);
      },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }

  showToast(msg: string) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 4000);
  }

  // ═══ Assignment Methods ═══

  get isAdmin(): boolean {
    return this.userRole === 'ADMINISTRATEUR';
  }

  get isInternalStaff(): boolean {
    return ['ADMINISTRATEUR', 'CHEF_DE_PROJET', 'SUPPORT_TECHNIQUE'].includes(this.userRole);
  }

  get assignableRoles() {
    return [
      { role: 'CHEF_DE_PROJET', label: 'Chef de Projet', icon: '👨‍💼', multi: false, color: 'hsl(var(--primary))' },
      { role: 'SUPPORT_TECHNIQUE', label: 'Support Technique', icon: '🛠️', multi: true, color: 'hsl(258 68% 62%)' },
      { role: 'TECHNICIEN', label: 'Technicien', icon: '🔧', multi: true, color: 'hsl(180 60% 45%)' }
    ];
  }

  getAssignments(role: string): any[] {
    return this.projet?.assignments?.filter((a: any) => a.role === role) || [];
  }

  get isAssignedSupport(): boolean {
    if (this.isAdmin) return true;
    if (this.userRole !== 'SUPPORT_TECHNIQUE') return false;
    return this.getAssignments('SUPPORT_TECHNIQUE').some(a => a.userId === this.authSvc.currentUser?.id);
  }

  get isAssignedPM(): boolean {
    if (this.isAdmin) return true;
    if (this.userRole !== 'CHEF_DE_PROJET') return false;
    return this.getAssignments('CHEF_DE_PROJET').some(a => a.userId === this.authSvc.currentUser?.id);
  }

  get isAssignedToProject(): boolean {
    if (this.isAdmin) return true;
    return this.projet?.assignments?.some((a: any) => a.userId === this.authSvc.currentUser?.id) || false;
  }

  get visibleDocuments(): DocumentProjet[] {
    if (!this.projet || !this.projet.documents) return [];
    if (this.isExternalUser()) {
      return this.projet.documents.filter(d => {
        // Masquer les fichiers internes staff
        if (d.typeDocument === 'DOCUMENT_INTERNE' || d.typeDocument === 'PLAN_TEST' || d.typeDocument === 'CAHIER_TEST') {
          return false;
        }
        // Masquer les livrables CDP (Cahier des charges, Fichiers techniques, Rapport de validation) au Client TANT QUE la Tranche 2 n'est pas payée
        if (this.projectContract && !this.isTranche2Paid) {
          if (d.typeDocument === 'CAHIER_DES_CHARGES' || d.typeDocument === 'DOCUMENT_TECHNIQUE' || d.typeDocument === 'RAPPORT_VALIDATION') {
            return false;
          }
        }
        return true;
      });
    }
    return this.projet.documents;
  }


  get canAssign(): boolean {
    if (this.isAdmin) return true;
    if (this.userRole === 'CHEF_DE_PROJET') {
      return this.getAssignments('CHEF_DE_PROJET').some(a => a.userId === (this.authSvc.userId || this.authSvc.currentUser?.id));
    }
    return false;
  }

  canAssignRole(role: string): boolean {
    if (this.isAdmin) return true;
    if (this.userRole === 'CHEF_DE_PROJET' && this.canAssign) {
      return role !== 'CHEF_DE_PROJET'; // Chef de Projet cannot assign another Chef
    }
    return false;
  }

  get canSelfAssign(): boolean {
    if (!this.projet) return false;
    const isConsultation = this.projet.cadrage?.objectif === 'IDEE' || this.projet.cadrage?.objectif === 'FAISABILITE';
    if (this.userRole === 'CHEF_DE_PROJET' || this.userRole === 'ADMINISTRATEUR' || this.userRole === 'ADMIN') {
      const hasChef = this.getAssignments('CHEF_DE_PROJET').length > 0;
      const allowedStatuts = ['PENDING', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'];
      return !hasChef && allowedStatuts.includes(this.projet.statut);
    }
    if (this.userRole === 'SUPPORT_TECHNIQUE') {
      const alreadyAssigned = this.getAssignments('SUPPORT_TECHNIQUE').some(a => a.userId === (this.authSvc.userId || this.authSvc.currentUser?.id));
      return isConsultation && !alreadyAssigned && this.projet.statut === 'PENDING';
    }
    return false;
  }

  openAssignModal(role: string) {
    this.assignRole = role as 'CHEF_DE_PROJET' | 'SUPPORT_TECHNIQUE' | 'TECHNICIEN';
    this.assignError = '';
    this.selectedStaffId = '';
    this.showAssignModal = true;
    this.loadStaff(role);
  }

  closeAssignModal() {
    this.showAssignModal = false;
  }

  getStaffWorkloadBadge(projectCount: number) {
    if (projectCount === 0) {
      return { label: '🟢 Disponible', bg: 'hsl(var(--success)/0.1)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success)/0.25)' };
    } else if (projectCount <= 2) {
      return { label: '🟡 Occupé', bg: 'hsl(var(--warning)/0.1)', color: 'hsl(var(--warning))', border: '1px solid hsl(var(--warning)/0.25)' };
    } else {
      return { label: '🔴 Très sollicité', bg: 'hsl(var(--destructive)/0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive)/0.25)' };
    }
  }

  isStaffOverloaded(): boolean {
    if (!this.selectedStaffId) return false;
    const staff = this.staffList.find(s => s.id === this.selectedStaffId);
    return !!staff && (staff.projectCount || 0) >= 3;
  }

  getSelectedStaffProjectCount(): number {
    if (!this.selectedStaffId) return 0;
    const staff = this.staffList.find(s => s.id === this.selectedStaffId);
    return staff ? (staff.projectCount || 0) : 0;
  }

  loadStaff(role: string) {
    this.loadingStaff = true;
    this.staffList = [];
    
    forkJoin({
      users: this.adminSvc.getUsersByRole(role),
      workloads: this.projetSvc.getWorkload()
    }).subscribe({
      next: ({ users, workloads }) => {
        const workloadMap = new Map<string, number>(
          workloads.map(w => [w.userId, w.projectCount])
        );

        this.staffList = users.map(u => ({
          ...u,
          projectCount: workloadMap.get(u.id) ?? 0
        }));

        // Tri par charge croissante, puis par ordre alphabétique prénom/nom (sécurisé)
        this.staffList.sort((a, b) => {
          const countA = a.projectCount || 0;
          const countB = b.projectCount || 0;
          if (countA !== countB) {
            return countA - countB;
          }
          const nameA = `${a.prenom ?? ''} ${a.nom ?? ''}`.trim();
          const nameB = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim();
          return nameA.localeCompare(nameB);
        });

        this.loadingStaff = false;
      },
      error: () => {
        this.loadingStaff = false;
        this.assignError = 'Impossible de charger la liste du personnel et sa charge de travail.';
      }
    });
  }

  doAssign() {
    if (!this.projet || !this.selectedStaffId) return;
    const staff = this.staffList.find(u => u.id === this.selectedStaffId);
    if (!staff) return;

    const req: ProjectAssignRequest = {
      userId: staff.id,
      nom: `${staff.prenom} ${staff.nom}`,
      role: this.assignRole
    };

    this.assigning = true;
    this.assignError = '';

    this.projetSvc.assign(this.projet.id, req).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.assigning = false;
        this.showAssignModal = false;
        this.showToast('Collaborateur affecté avec succès !');
        
        // Reload profiles
        this.loadProjet(updated.id);
      },
      error: (err) => {
        this.assigning = false;
        this.assignError = err.error?.message || 'Erreur lors de l\'affectation.';
      }
    });
  }

  doSelfAssign() {
    if (!this.projet) return;
    this.assigning = true;
    this.projetSvc.selfAssign(this.projet.id).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.assigning = false;
        this.showToast('Vous avez été affecté à ce projet avec succès !');
        this.loadProjet(updated.id);
      },
      error: (err) => {
        this.assigning = false;
        this.showToast(err.error?.message || 'Erreur lors de l\'auto-affectation.');
      }
    });
  }

  openHistory() {
    if (!this.projet) return;
    this.showHistoryModal = true;
    this.loadingHistory = true;
    this.projetSvc.getAssignmentHistory(this.projet.id).subscribe({
      next: (history) => {
        this.assignmentHistory = history;
        this.loadingHistory = false;
      },
      error: () => {
        this.loadingHistory = false;
      }
    });
  }

  closeHistory() {
    this.showHistoryModal = false;
  }

  getAssignRoleLabel(role: string): string {
    switch (role) {
      case 'CHEF_DE_PROJET': return 'Chef de Projet';
      case 'SUPPORT_TECHNIQUE': return 'Support Technique';
      default: return role;
    }
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'ASSIGNED': return 'Affecté';
      case 'SELF_ASSIGNED': return 'Auto-affecté';
      case 'UNASSIGNED': return 'Retiré';
      default: return action;
    }
  }

  getActionColor(action: string): string {
    switch (action) {
      case 'ASSIGNED': case 'SELF_ASSIGNED': return 'hsl(var(--success))';
      case 'UNASSIGNED': return 'hsl(var(--destructive))';
      default: return 'hsl(var(--muted-foreground))';
    }
  }

  // ── BOM & Stock status actions ──

  get isProjectOwner(): boolean {
    if (!this.projet) return false;
    return this.isExternalUser() && this.projet.userId === this.authSvc.currentUser?.id;
  }

  uploadingDocument = false;
  documentUploadError = '';
  documentUploadSuccess = '';

  // ── États individuels pour les 3 zones Validation ──
  uploadingPlanTest = false;
  uploadingCahierTest = false;
  uploadingRapportValidation = false;
  validationUploadError = '';
  validationUploadSuccess = '';
  showValidationConfirmModal = false;

  get planTestDoc(): DocumentProjet | undefined {
    return this.projet?.documents?.find(d => d.typeDocument === 'PLAN_TEST');
  }

  get cahierTestDoc(): DocumentProjet | undefined {
    return this.projet?.documents?.find(d => d.typeDocument === 'CAHIER_TEST');
  }

  get rapportValidationDoc(): DocumentProjet | undefined {
    return this.projet?.documents?.find(d => d.typeDocument === 'RAPPORT_VALIDATION');
  }

  confirmTerminerValidation() {
    this.updateStageValidation('VALIDATION_TERMINEE');
    this.showValidationConfirmModal = false;
  }

  deleteValidationDoc(docId: string) {
    if (!this.projet || !docId) return;
    if (!confirm('Voulez-vous vraiment supprimer ce document ?')) return;

    this.validationUploadError = '';
    this.validationUploadSuccess = '';

    this.projetSvc.deleteDocument(this.projet.id, docId).subscribe({
      next: () => {
        this.validationUploadSuccess = 'Document supprimé avec succès !';
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => {
          this.projet = p;
        });
        setTimeout(() => this.validationUploadSuccess = '', 4000);
      },
      error: (err) => {
        this.validationUploadError = err.error?.message || 'Erreur lors de la suppression du document.';
      }
    });
  }

  /** Handler générique conservé pour d'autres usages */
  onDocumentFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.projet) return;
    const file = input.files[0];
    this.uploadingDocument = true;
    this.documentUploadError = '';
    this.documentUploadSuccess = '';
    if (this.projet?.cadrage?.objectif === 'VALIDATION') {
      if (this.projet.stage === 'PREPARATION_TESTS' && (!this.selectedDocumentType || this.selectedDocumentType === 'GERBER' || this.selectedDocumentType === 'DOCUMENT_TECHNIQUE')) {
        this.selectedDocumentType = 'PLAN_TEST';
      } else if (this.projet.stage === 'TESTS_EN_COURS' && (!this.selectedDocumentType || this.selectedDocumentType === 'GERBER' || this.selectedDocumentType === 'DOCUMENT_TECHNIQUE')) {
        this.selectedDocumentType = 'RAPPORT_VALIDATION';
      }
    } else {
      this.selectedDocumentType = this.selectedDocumentType || 'GERBER';
    }

    this.projetSvc.uploadDocument(this.projet.id, file, this.selectedDocumentType).subscribe({
      next: () => {
        this.uploadingDocument = false;
        this.documentUploadSuccess = `Document ${this.selectedDocumentType} téléversé avec succès !`;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
        setTimeout(() => this.documentUploadSuccess = '', 4000);
      },
      error: (err) => {
        this.uploadingDocument = false;
        this.documentUploadError = err.error?.message || 'Erreur lors du téléversement du document.';
      }
    });
  }

  /** Upload dédié — Plan de Test → avance automatiquement vers TESTS_EN_COURS */
  onPlanTestFileSelected(event: Event) {
    this.uploadValidationDoc(event, 'PLAN_TEST', (v) => this.uploadingPlanTest = v);
  }

  /** Upload dédié — Cahier de Test → avance automatiquement vers TESTS_EN_COURS */
  onCahierTestFileSelected(event: Event) {
    this.uploadValidationDoc(event, 'CAHIER_TEST', (v) => this.uploadingCahierTest = v);
  }

  /** Upload dédié — Rapport de Validation → avance automatiquement vers RAPPORT_VALIDATION_DISPONIBLE */
  onRapportValidationFileSelected(event: Event) {
    this.uploadValidationDoc(event, 'RAPPORT_VALIDATION', (v) => this.uploadingRapportValidation = v);
  }

  private uploadValidationDoc(event: Event, type: TypeDocumentProjet, setLoading: (v: boolean) => void) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.projet) return;

    if (!this.canCdpUploadValidationFiles) {
      this.validationUploadError = 'Action bloquée : Le devis doit être validé et l\'acompte (Tranche 1 - 50%) doit être réglé par le client avant de pouvoir déposer des livrables de validation.';
      input.value = '';
      return;
    }

    const file = input.files[0];
    setLoading(true);
    this.validationUploadError = '';
    this.validationUploadSuccess = '';

    this.projetSvc.uploadDocument(this.projet.id, file, type).subscribe({
      next: () => {
        setLoading(false);
        this.validationUploadSuccess = `✅ "${file.name}" téléversé avec succès !`;
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => {
          this.projet = p;
          // reset input so same file can be re-sélectionné si besoin
          input.value = '';
          if (type === 'RAPPORT_VALIDATION') {
            this.showValidationConfirmModal = true;
          }
        });
        setTimeout(() => this.validationUploadSuccess = '', 5000);
      },
      error: (err) => {
        setLoading(false);
        this.validationUploadError = err.error?.message || `Erreur lors du téléversement de ${type}.`;
      }
    });
  }



  get isPcbOnly(): boolean {
    if (!this.projet || !this.projet.cadrage) return false;
    if (this.projet.cadrage.objectif !== 'PROTOTYPE') return false;
    const mfg = this.projet.cadrage.manufacturingNeeds || [];
    return mfg.includes('PCB_FAB') && !mfg.includes('SMT_ASSEMBLY') && !mfg.includes('PROTOTYPE_ASSEMBLY');
  }

  hasGerberDocument(): boolean {
    if (!this.projet) return false;
    if (this.projet.documents && this.projet.documents.length > 0) {
      const foundInDocs = this.projet.documents.some(d => {
        if (d.typeDocument === 'GERBER') return true;
        const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
        return name.includes('gerber') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
      });
      if (foundInDocs) return true;
    }
    if (this.projet.fichiersTechniques && this.projet.fichiersTechniques.length > 0) {
      const foundInTech = this.projet.fichiersTechniques.some((f: any) => {
        const name = (typeof f === 'string' ? f : f.name || f.fileUrl || '').toLowerCase();
        return name.includes('gerber') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
      });
      if (foundInTech) return true;
    }
    return false;
  }

  hasBomDocument(): boolean {
    if (!this.projet) return false;
    if (this.projet.bomUploaded) return true;
    if (this.projet.documents && this.projet.documents.length > 0) {
      return this.projet.documents.some((d: any) => {
        if (d.typeDocument === 'BOM') return true;
        if (d.typeDocument === 'PICK_AND_PLACE' || d.typeDocument === 'GERBER' || d.typeDocument === 'DRILL_FILE' || d.typeDocument === 'SOP' || d.typeDocument === 'DIAGRAMME') return false;
        const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
        return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
      });
    }
    return false;
  }

  hasPickAndPlaceDocument(): boolean {
    if (!this.projet) return false;
    return this.projet.documents?.some((d: any) => d.typeDocument === 'PICK_AND_PLACE') || false;
  }

  isPickAndPlaceRequired(): boolean {
    if (!this.projet || !this.projet.cadrage) return false;
    if (this.isPcbOnly) return false;
    const obj = this.projet.cadrage.objectif;
    return obj === 'PROTOTYPE' || obj === 'PRODUCTION';
  }

  getTotalRequiredFilesCount(): number {
    if (this.isPcbOnly) return 1;
    if (this.isPickAndPlaceRequired()) return 4; // Gerber + BOM + Pick & Place + SOP
    return 2;
  }

  isStep1Complete(): boolean {
    if (this.isPcbOnly) return this.hasGerberDocument();
    if (this.isPickAndPlaceRequired()) {
      return this.hasGerberDocument() && this.hasBomDocument() && this.hasPickAndPlaceDocument();
    }
    return this.hasGerberDocument() && this.hasBomDocument();
  }

  getMissingFilesLabel(): string {
    const missing: string[] = [];
    if (!this.hasGerberDocument()) missing.push('Gerber');
    if (!this.isPcbOnly && !this.hasBomDocument()) missing.push('BOM');
    if (this.isPickAndPlaceRequired() && !this.hasPickAndPlaceDocument()) missing.push('Pick & Place');
    if (this.isSopRequired() && !this.hasSopDocument()) missing.push('SOP');

    if (missing.length === 0) return 'Tous les fichiers reçus';
    return missing.join(' + ') + ' requis';
  }

  get isBomAvailable(): boolean {
    if (!this.projet || this.isPcbOnly) return false;
    return this.projet.bomRequired || ['PROTOTYPE', 'VALIDATION', 'PRODUCTION'].includes(this.projet.cadrage?.objectif || '');
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
          // Recharger le projet pour refléter le nouveau stage EN_ATTENTE_CLIENT dans le stepper
          this.projetSvc.getProjet(this.projet!.id).subscribe({
            next: (updated) => { this.projet = updated; },
            error: () => {}
          });
        }
        this.checkingStock = false;
      },
      error: (err) => {
        this.checkingStock = false;
        this.stockCheckError = err.error?.message || 'Impossible de récupérer le statut des stocks.';
      }
    });
  }

  productionQuantiteSouhaitee = 1000;

  // --- Stage helpers & custom actions ---
  getStageLabel(stage?: ProjectStage): string {
    if (!stage) return '📞 En attente de contact support';
    switch (stage) {
      case 'EN_COURS_ANALYSE': return '🔍 Analyse en cours par le consultant';
      case 'REDACTION_CAHIER_CHARGES': return '📝 Rédaction Cahier des Charges';
      case 'FICHIERS_TECHNIQUES': return '📁 Fichiers techniques disponibles';
      case 'PRET_POUR_FLUX': return '✅ Prêt pour le flux suivant';
      case 'ABANDONNE': return '❌ Abandonné';
      case 'FICHIERS_RECUS': return '📦 Fichiers reçus - Traitement en cours';
      case 'BOM_ANALYSEE': return '📊 Nomenclature analysée';
      case 'EN_ATTENTE_CLIENT': return '⏳ En attente de décision client';
      case 'ALTERNATIVES_EN_ATTENTE': return '🔄 Alternatives en cours de validation';
      case 'BOM_VALIDEE': return '🎉 BOM Validée';
      case 'PREPARATION_TESTS': return '📋 Préparation des tests & protocoles';
      case 'TESTS_EN_COURS': return '🧪 Tests en cours d\'exécution';
      case 'RAPPORT_VALIDATION_DISPONIBLE': return '📄 Rapport de validation disponible';
      case 'VALIDATION_TERMINEE': return '✅ Phase Validation terminée';
      default: return 'Inconnu';
    }
  }

  // ── Scénario 3 Validation & Transitions ──
  transitionToValidation() {
    if (!this.projet) return;
    this.saving = true;
    this.saveError = '';
    this.projetSvc.transitionToValidation(this.projet.id).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showToast('Bascule vers la Validation effectuée avec succès !');

        // Redirection vers le Cadrage pour permettre au client de choisir ses délais et spécifications
        setTimeout(() => this.router.navigate(['/client/projets', updated.id, 'cadrage']), 600);
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Erreur lors de la transition vers la Validation.';
      }
    });
  }

  transitionToProduction() {
    if (!this.projet) return;
    this.saving = true;
    this.saveError = '';
    this.projetSvc.transitionToProduction(this.projet.id, this.productionQuantiteSouhaitee).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showToast('Bascule vers la Production effectuée avec succès !');

        const hasGerber = this.hasGerberDocument();
        const hasBom = this.hasBomDocument();
        const hasPickAndPlace = updated.documents && updated.documents.some(d => d.typeDocument === 'PICK_AND_PLACE');

        if (!hasGerber) {
          setTimeout(() => this.router.navigate(['/client/projets', updated.id, 'upload-gerber']), 800);
        } else if (!hasPickAndPlace) {
          this.showToast('⚠️ Gerber & BOM détectés ! Redirection pour téléverser le fichier Pick & Place (CPL)...');
          setTimeout(() => this.router.navigate(['/client/projets', updated.id, 'upload-gerber']), 800);
        } else if (!hasBom && !this.isPcbOnly) {
          setTimeout(() => this.router.navigate(['/client/projets', updated.id, 'bom']), 800);
        } else {
          setTimeout(() => this.router.navigate(['/client/projets', updated.id]), 800);
        }
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Erreur lors de la transition vers la Production.';
      }
    });
  }

  confirmProductionTransition() {
    this.showProductionModal = false;
    this.transitionToProduction();
  }

  getValidationSteps(): { stage: ProjectStage; label: string; icon: string }[] {
    return [
      { stage: 'PREPARATION_TESTS', label: 'Préparation des tests', icon: '📋' },
      { stage: 'TESTS_EN_COURS', label: 'Tests en cours', icon: '🧪' },
      { stage: 'RAPPORT_VALIDATION_DISPONIBLE', label: 'Rapport disponible', icon: '📄' },
      { stage: 'VALIDATION_TERMINEE', label: 'Validation terminée', icon: '✅' },
    ];
  }

  getProductionSteps(): { stage: ProjectStage; label: string; icon: string }[] {
    return [
      { stage: 'FICHIERS_RECUS', label: 'Fichiers reçus', icon: '📦' },
      { stage: 'BOM_ANALYSEE', label: 'BOM Série analysée', icon: '📊' },
      { stage: 'ALTERNATIVES_EN_ATTENTE', label: 'Alternatives Série', icon: '🔄' },
      { stage: 'BOM_VALIDEE', label: 'BOM Série validée', icon: '🎉' },
    ];
  }



  updateStageValidation(stage: ProjectStage) {
    if (!this.projet) return;
    this.saving = true;
    this.saveError = '';
    this.projetSvc.updateStage(this.projet.id, stage).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showToast('Stage mis à jour avec succès !');
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Erreur lors du changement de stage.';
      }
    });
  }

  updateStageProduction(stage: ProjectStage) {
    if (!this.projet) return;
    this.saving = true;
    this.saveError = '';
    this.projetSvc.updateStageProduction(this.projet.id, stage).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showToast('Stage Production mis à jour avec succès !');
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Erreur lors du changement de stage Production.';
      }
    });
  }


  // ── Unified Document Management ──
  selectedDocumentType: TypeDocumentProjet = 'DOCUMENT_TECHNIQUE';

  getTypeDocumentLabel(type?: TypeDocumentProjet): string {
    if (!type) return 'Document';
    switch (type) {
      case 'DOCUMENT_IDEE': return '💡 Croquis / Document d\'Idée';
      case 'CAHIER_DES_CHARGES': return '📜 Cahier des Charges';
      case 'DOCUMENT_TECHNIQUE': return '📁 Document Technique';
      case 'DOCUMENT_INTERNE': return '🔒 Document Interne';
      case 'BOM': return '📊 Nomenclature (BOM)';
      case 'GERBER': return '🗺️ Fichier Gerber';
      case 'PICK_AND_PLACE': return '🤖 Pick & Place (CPL)';
      case 'DRILL_FILE': return '🎯 Fichier de Perçage (Drill File)';
      case 'SOP': return '📘 Procédure Opératoire (SOP)';
      case 'DIAGRAMME': return '📐 Schémas & Diagrammes';
      case 'PLAN_TEST': return '📋 Plan de Test';
      case 'CAHIER_TEST': return '📕 Cahier de Test';
      case 'RAPPORT_VALIDATION': return '📄 Rapport de Validation';
      default: return '📄 Autre Document';
    }
  }

  getCleanTypeLabel(type?: TypeDocumentProjet): string {
    if (!type) return 'Document';
    switch (type) {
      case 'DOCUMENT_IDEE': return 'Croquis / Document d\'Idée';
      case 'CAHIER_DES_CHARGES': return 'Cahier des Charges';
      case 'DOCUMENT_TECHNIQUE': return 'Document Technique';
      case 'DOCUMENT_INTERNE': return 'Document Interne';
      case 'BOM': return 'Nomenclature (BOM)';
      case 'GERBER': return 'Fichier Gerber';
      case 'PICK_AND_PLACE': return 'Pick & Place (CPL)';
      case 'DRILL_FILE': return 'Fichier de Perçage';
      case 'SOP': return 'Procédure Opératoire (SOP)';
      case 'DIAGRAMME': return 'Schémas & Diagrammes';
      case 'PLAN_TEST': return 'Plan de Test';
      case 'CAHIER_TEST': return 'Cahier de Test';
      case 'RAPPORT_VALIDATION': return 'Rapport de Validation';
      default: return 'Document';
    }
  }

  isPdfDoc(doc: DocumentProjet): boolean {
    const name = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
    return name.endsWith('.pdf') || doc.typeDocument === 'CAHIER_TEST' || doc.typeDocument === 'RAPPORT_VALIDATION';
  }

  isSpreadsheetDoc(doc: DocumentProjet): boolean {
    const name = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || doc.typeDocument === 'BOM' || doc.typeDocument === 'SOP';
  }

  isArchiveDoc(doc: DocumentProjet): boolean {
    const name = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
    return name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || doc.typeDocument === 'GERBER';
  }

  isInternalDoc(doc: DocumentProjet): boolean {
    return doc.typeDocument === 'DOCUMENT_INTERNE';
  }

  showIdeaUploadModal: boolean = false;

  uploadClientIdeaFile(event: any) {
    if (!this.projet || !event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    this.uploadingFiles = true;
    this.projetSvc.uploadDocument(this.projet.id, file, 'DOCUMENT_IDEE').subscribe({
      next: () => {
        this.uploadingFiles = false;
        this.showIdeaUploadModal = false;
        this.showToast('Document d\'idée téléversé avec succès !');
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingFiles = false;
        this.showToast(err.error?.message || 'Erreur lors du téléversement du document.');
      }
    });
  }

  closeIdeaUploadModal() {
    this.showIdeaUploadModal = false;
  }

  uploadUnifiedDocument(typeDocument?: TypeDocumentProjet) {

    if (!this.projet || this.selectedFiles.length === 0) return;
    this.uploadingFiles = true;
    this.uploadError = '';
    const file = this.selectedFiles[0];
    const targetType = typeDocument || this.selectedDocumentType || 'DOCUMENT_TECHNIQUE';

    this.projetSvc.uploadDocument(this.projet.id, file, targetType).subscribe({
      next: () => {
        this.selectedFiles = [];
        this.uploadingFiles = false;
        this.showToast('Document téléversé avec succès !');
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.uploadingFiles = false;
        this.uploadError = err.error?.message || 'Erreur lors du téléversement du document.';
      }
    });
  }

  canDeleteUnifiedDocument(doc: DocumentProjet): boolean {
    if (!doc || !this.projet) return false;
    const currentUserId = this.authSvc.currentUser?.id;

    // 1. Administrateur : accès total à la suppression
    if (this.userRole === 'ADMINISTRATEUR' || this.userRole === 'ADMIN') return true;

    // 2. Fichiers d'Idée déposés par le Client (DOCUMENT_IDEE ou uploadés par le client)
    const isClientIdeaFile = doc.typeDocument === 'DOCUMENT_IDEE' || (!!this.projet.userId && doc.uploadedBy === this.projet.userId);
    if (isClientIdeaFile) {
      // ➔ SEUL le Client Externe peut supprimer ses propres croquis / fichiers d'idée !
      return this.isExternalUser();
    }

    // 3. Fichiers Internes (Rapports Support)
    if (doc.typeDocument === 'DOCUMENT_INTERNE') {
      // ➔ SEUL le Support Technique peut supprimer les documents internes !
      return this.userRole === 'SUPPORT_TECHNIQUE';
    }

    // 4. Fichiers Techniques & Livrables PM (DOCUMENT_TECHNIQUE / CAHIER_DES_CHARGES)
    if (doc.typeDocument === 'DOCUMENT_TECHNIQUE' || doc.typeDocument === 'CAHIER_DES_CHARGES') {
      // ➔ SEUL le Chef de Projet peut supprimer les fichiers techniques !
      return this.userRole === 'CHEF_DE_PROJET';
    }

    // Fallback : l'utilisateur qui a déposé le fichier peut le supprimer
    return !!currentUserId && doc.uploadedBy === currentUserId;
  }

  deleteUnifiedDocument(documentId: string) {
    if (!this.projet) return;
    this.projetSvc.deleteDocument(this.projet.id, documentId).subscribe({
      next: () => {
        this.showToast('Document supprimé avec succès.');
        this.projetSvc.getProjet(this.projet!.id).subscribe(p => this.projet = p);
      },
      error: (err) => {
        this.showToast('Erreur lors de la suppression du document.');
      }
    });
  }

  onFilesSelected(event: any) {
    const fileList: FileList = event.target.files;
    this.selectedFiles = [];
    for (let i = 0; i < fileList.length; i++) {
      this.selectedFiles.push(fileList.item(i)!);
    }
  }

  uploadTechnicalFiles() {
    if (!this.projet || this.selectedFiles.length === 0) return;
    this.uploadingFiles = true;
    this.uploadError = '';
    this.projetSvc.uploadFichiersTechniques(this.projet.id, this.selectedFiles).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.uploadingFiles = false;
        this.selectedFiles = [];
        this.showToast('Fichiers techniques déposés avec succès !');
      },
      error: (err) => {
        this.uploadingFiles = false;
        this.uploadError = err.error?.message || 'Erreur lors du dépôt des fichiers.';
      }
    });
  }

  validateFiles() {
    this.showValidationModal = true;
  }

  cancelValidation() {
    this.showValidationModal = false;
  }

  confirmValidation() {
    if (!this.projet) return;
    this.showValidationModal = false;
    this.validatingFiles = true;
    this.projetSvc.validerFichiers(this.projet.id).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.validatingFiles = false;
        this.showToast('Fichiers techniques validés avec succès !');
      },
      error: (err) => {
        this.validatingFiles = false;
        this.showToast(err.error?.message || 'Erreur lors de la validation des fichiers.');
      }
    });
  }

  getFileName(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    // Supprimer le préfixe UUID (36 caractères + '_')
    if (lastPart.length > 37 && lastPart.charAt(36) === '_') {
      return lastPart.substring(37);
    }
    return lastPart;
  }

  downloadTechnicalFile(url: string, defaultName?: string) {
    if (!url) return;
    let name = defaultName || this.getFileName(url) || 'document';
    // Remove UUID prefix if present
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}_/.test(name)) {
      name = name.substring(37);
    }
    // Ensure proper extension
    if (!name.includes('.')) {
      const lower = name.toLowerCase();
      if (lower.includes('gerber') || lower.includes('drill') || lower.includes('pick') || lower.includes('archive')) {
        name += '.zip';
      } else if (lower.includes('facture') || lower.includes('contrat') || lower.includes('devis') || lower.includes('rapport') || lower.includes('plan') || lower.includes('cahier')) {
        name += '.pdf';
      } else if (lower.includes('bom')) {
        name += '.xlsx';
      } else {
        name += '.zip';
      }
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
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

  clearSelectedFiles() {
    this.selectedFiles = [];
  }

  initiateDeleteFile(url: string) {
    this.fileToDeleteUrl = url;
    this.fileToDeleteName = this.getFileName(url);
    this.showDeleteFileModal = true;
  }

  cancelDeleteFile() {
    this.showDeleteFileModal = false;
    this.fileToDeleteUrl = '';
    this.fileToDeleteName = '';
  }

  confirmDeleteFile() {
    if (!this.projet || !this.fileToDeleteUrl) return;
    const url = this.fileToDeleteUrl;
    this.cancelDeleteFile();
    this.projetSvc.deleteFichierTechnique(this.projet.id, url).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.showToast('Fichier technique supprimé.');
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Erreur lors de la suppression du fichier.');
      }
    });
  }



  get cahierDesChargesDoc(): any {
    if (!this.projet) return null;
    if (this.projet.documents && this.projet.documents.length > 0) {
      const found = this.projet.documents.find((d: any) => d.typeDocument === 'CAHIER_DES_CHARGES');
      if (found) return found;
    }
    return null;
  }

  hasCahierDesChargesDoc(): boolean {
    return !!this.cahierDesChargesDoc;
  }

  getIdeeStepIndex(): number {
    if (!this.projet) return 1;
    if (this.projet.stage === 'ABANDONNE' || this.projet.statut === 'CANCELLED') return 0;
    const stage = this.projet.stage;
    if (!stage || stage === 'EN_ATTENTE_CONTACT_SUPPORT') return 1;
    if (stage === 'EN_COURS_ANALYSE') return 2;
    if (stage === 'REDACTION_CAHIER_CHARGES' || stage === 'FICHIERS_TECHNIQUES') return 3;
    if (stage === 'PRET_POUR_FLUX') return 4;
    return 3;
  }

  getIdeeProgressPercent(): number {
    if (this.projet?.stage === 'ABANDONNE' || this.projet?.statut === 'CANCELLED') return 0;
    const step = this.getIdeeStepIndex();
    if (step === 1) return 15;
    if (step === 2) return 45;
    if (step === 3) return 75;
    if (step === 4) return 100;
    return 0;
  }

  transitionToFaisabilite() {
    if (!this.projet) return;
    this.saving = true;
    this.saveError = '';
    this.projetSvc.transitionToFaisabilite(this.projet.id).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.saving = false;
        this.showToast('Bascule vers la Faisabilité effectuée avec succès !');
        setTimeout(() => this.router.navigate(['/client/projets', updated.id]), 800);
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err.error?.message || 'Erreur lors de la transition vers la Faisabilité.';
      }
    });
  }

  getClassiqueStepIndex(): number {
    return this.getPrototypeStepIndex();
  }

  getClassiqueProgressPercent(): number {
    return this.getPrototypeProgressPercent();
  }



  get gerberDoc(): any {
    if (!this.projet) return null;
    if (this.projet.documents && this.projet.documents.length > 0) {
      const found = this.projet.documents.find((d: any) => {
        if (d.typeDocument === 'GERBER') return true;
        if (d.typeDocument === 'SOP' || d.typeDocument === 'PICK_AND_PLACE' || d.typeDocument === 'BOM' || d.typeDocument === 'DIAGRAMME') return false;
        const name = (d.nomDocument || d.fileUrl || '').toLowerCase();
        return name.includes('gerber') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z');
      });
      if (found) return found;
    }
    return null;
  }

  get pickAndPlaceDoc(): any {
    if (!this.projet || !this.projet.documents) return null;
    return this.projet.documents.find((d: any) => d.typeDocument === 'PICK_AND_PLACE') || null;
  }

  get sopDoc(): any {
    if (!this.projet || !this.projet.documents) return null;
    return this.projet.documents.find((d: any) => d.typeDocument === 'SOP') || null;
  }

  hasSopDocument(): boolean {
    return !!this.sopDoc;
  }

  get diagrammeDoc(): any {
    if (!this.projet || !this.projet.documents) return null;
    return this.projet.documents.find((d: any) => d.typeDocument === 'DIAGRAMME') || null;
  }

  hasDiagrammeDocument(): boolean {
    return !!this.diagrammeDoc;
  }

  /**
   * La SOP n'est plus exigee.
   *
   * C'est une procedure de montage, redigee quand elle sert — pas une piece
   * que le dossier doit contenir. La compter parmi les requis bloquait a 3/4
   * un dossier qui avait tout ce qu'il faut pour etre chiffre.
   *
   * Elle reste detectee et affichee quand elle existe.
   */
  isSopRequired(): boolean {
    return false;
  }

  get drillDoc(): any {
    if (!this.projet || !this.projet.documents) return null;
    return this.projet.documents.find((d: any) => d.typeDocument === 'DRILL_FILE') || null;
  }

  getReceivedFilesCount(): number {
    let count = 0;
    if (this.hasGerberDocument()) count++;
    if (!this.isPcbOnly && this.hasBomDocument()) count++;
    if (this.isPickAndPlaceRequired() && this.hasPickAndPlaceDocument()) count++;
    if (this.isSopRequired() && this.hasSopDocument()) count++;
    return count;
  }

  // ── Prototype Stepper helpers (5 PCBA Steps) ──
  // Step 1: Fichiers reçus (Gerber & BOM)
  // Step 2: Nomenclature analysée
  // Step 3: Décision client
  // Step 4: Validation alternatives
  // Step 5: BOM validée
  getPrototypeStepIndex(): number {
    if (!this.projet) return 1;
    const stage = this.projet.stage;
    const filesCount = this.getReceivedFilesCount();

    if (!this.isStep1Complete() && (!stage || stage === 'FICHIERS_RECUS' || stage === 'EN_ATTENTE_CONTACT_SUPPORT')) {
      return 1;
    }

    if (stage === 'EN_ATTENTE_CLIENT') return 3;
    if (stage === 'ALTERNATIVES_EN_ATTENTE') return 4;
    if (stage === 'BOM_VALIDEE') return 5;

    // Si l'étape 1 est complète et la BOM est présente, l'analyse de nomenclature est faite -> Étape 3 (Décision client)
    if (this.isStep1Complete() && this.hasBomDocument()) {
      return 3;
    }

    if (!stage || stage === 'FICHIERS_RECUS' || stage === 'BOM_ANALYSEE') return 2;
    return 2;
  }

  getPrototypeProgressPercent(): number {
    const filesCount = this.getReceivedFilesCount();
    const step = this.getPrototypeStepIndex();

    if (step === 1) {
      if (filesCount === 0) return 5;
      if (filesCount === 1) return 15;
      return 25;
    }
    if (step === 2) return 40;
    if (step === 3) return 60;
    if (step === 4) return 80;
    if (step === 5) return 100;
    return 10;
  }

  // ── Validation Stepper helpers (5 Validation Steps) ──
  getValidationStepIndex(): number {
    if (!this.projet) return 1;
    if (!this.hasBomDocument()) return 1;
    const stage = this.projet.stage;
    if (stage === 'PREPARATION_TESTS') return 2;
    if (stage === 'TESTS_EN_COURS') return 3;
    if (stage === 'RAPPORT_VALIDATION_DISPONIBLE') {
      return (this.projectContract && this.isTranche2Paid) ? 5 : 4;
    }
    if (stage === 'VALIDATION_TERMINEE') {
      return (this.projectContract && !this.isTranche2Paid) ? 4 : 5;
    }
    return 2;
  }

  getValidationProgressPercent(): number {
    const step = this.getValidationStepIndex();
    if (step === 1) return 20;
    if (step === 2) return 40;
    if (step === 3) return 60;
    if (step === 4) return 80;
    if (step === 5) return 100;
    return 20;
  }

  getPrototypeStepLabel(step: number): string {
    switch (step) {
      case 1: return 'Nomenclature analysée';
      case 2: return 'Décision client';
      case 3: return 'Validation alternatives';
      case 4: return 'BOM validée';
      default: return '';
    }
  }

  getPrototypeStepSubtitle(step: number): string {
    const currentStep = this.getPrototypeStepIndex();
    if (currentStep === 0) return 'En attente d\'upload BOM';
    if (step < currentStep) return 'Complété';
    if (step === currentStep) {
      switch (step) {
        case 1: return 'Analyse des stocks en cours';
        case 2: return 'En attente de votre réponse';
        case 3: return 'Choix des alternatives';
        case 4: return 'Prêt pour le devis';
        default: return 'En cours';
      }
    }
    return 'En attente';
  }

  getPrototypeStepEmoji(step: number): string {
    switch (step) {
      case 1: return '📊';
      case 2: return '⏳';
      case 3: return '🔄';
      case 4: return '✅';
      default: return '📋';
    }
  }

  // ── Transition Phase 1 -> Phase 2 (Prototype) ────────────────
  showTransitionModal = false;
  selectedBomFileUrl = '';
  transitioning = false;
  transitionError = '';

  getExcelOrCsvFiles(): string[] {
    if (!this.projet?.documents) return [];
    const urls: string[] = [];

    this.projet.documents.forEach(doc => {
      if (doc.typeDocument === 'SOP' || doc.typeDocument === 'PICK_AND_PLACE' || doc.typeDocument === 'GERBER' || doc.typeDocument === 'DRILL_FILE') return;
      const nameOrUrl = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
      if (doc.typeDocument === 'BOM' || nameOrUrl.endsWith('.xlsx') || nameOrUrl.endsWith('.xls') || nameOrUrl.endsWith('.csv')) {
        if (doc.fileUrl && !urls.includes(doc.fileUrl)) {
          urls.push(doc.fileUrl);
        }
      }
    });

    return urls;
  }

  getFileNameFromUrl(url: string): string {
    if (!url) return '';
    if (this.projet?.documents) {
      const doc = this.projet.documents.find(d => d.fileUrl === url);
      if (doc && doc.nomDocument) {
        return doc.nomDocument;
      }
    }
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/');
    const fullName = parts[parts.length - 1] || 'fichier';
    const underscoreIdx = fullName.indexOf('_');
    if (underscoreIdx !== -1 && underscoreIdx < 40) {
      return fullName.substring(underscoreIdx + 1);
    }
    return fullName;
  }

  getDocumentIcon(doc: DocumentProjet): string {
    if (doc.typeDocument === 'SOP') return '📘';
    if (doc.typeDocument === 'PICK_AND_PLACE') return '🤖';
    if (doc.typeDocument === 'BOM') return '📊';
    if (doc.typeDocument === 'GERBER') return '🗺️';
    if (doc.typeDocument === 'DRILL_FILE') return '🔩';
    if (doc.typeDocument === 'DIAGRAMME') return '📐';
    if (doc.typeDocument === 'PLAN_TEST' || doc.typeDocument === 'CAHIER_TEST') return '📋';
    if (doc.typeDocument === 'DOCUMENT_INTERNE') return '🔒';
    const name = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return '📊';
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return '🗺️';
    if (name.endsWith('.pdf')) return '📕';
    if (name.endsWith('.docx') || name.endsWith('.doc')) return '📝';
    return '📁';
  }

  getDocumentClass(doc: DocumentProjet): string {
    if (doc.typeDocument === 'SOP') return 'bg-blue-500/10 text-blue-500';
    if (doc.typeDocument === 'PICK_AND_PLACE') return 'bg-indigo-500/10 text-indigo-500';
    if (doc.typeDocument === 'BOM') return 'bg-emerald-500/10 text-emerald-500';
    if (doc.typeDocument === 'GERBER') return 'bg-amber-500/10 text-amber-500';
    if (doc.typeDocument === 'DRILL_FILE') return 'bg-slate-500/10 text-slate-500';
    if (doc.typeDocument === 'DIAGRAMME') return 'bg-teal-500/10 text-teal-500';
    if (doc.typeDocument === 'PLAN_TEST' || doc.typeDocument === 'CAHIER_TEST') return 'bg-indigo-500/10 text-indigo-500';
    if (doc.typeDocument === 'DOCUMENT_INTERNE') return 'bg-amber-500/15 text-amber-600';
    const name = (doc.nomDocument || doc.fileUrl || '').split('?')[0].toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'bg-emerald-500/10 text-emerald-500';
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'bg-amber-500/10 text-amber-500';
    if (name.endsWith('.pdf')) return 'bg-rose-500/10 text-rose-500';
    if (name.endsWith('.docx') || name.endsWith('.doc')) return 'bg-blue-500/10 text-blue-500';
    return 'bg-primary/10 text-primary';
  }

  openTransitionModal() {
    this.transitionError = '';
    const excelFiles = this.getExcelOrCsvFiles();
    if (excelFiles.length > 0) {
      this.selectedBomFileUrl = excelFiles[0];
    } else {
      this.selectedBomFileUrl = '';
    }
    this.showTransitionModal = true;
  }

  closeTransitionModal() {
    this.showTransitionModal = false;
    this.transitionError = '';
  }

  confirmTransition() {
    if (!this.projet) return;
    const excelFiles = this.getExcelOrCsvFiles();
    if (excelFiles.length > 0 && !this.selectedBomFileUrl) {
      this.transitionError = 'Veuillez sélectionner un fichier BOM pour la transition.';
      return;
    }

    let bomFileId = '';
    if (this.selectedBomFileUrl) {
      const clean = this.selectedBomFileUrl.split('?')[0].split('#')[0];
      bomFileId = clean.substring(clean.lastIndexOf('/') + 1);
    }

    this.transitioning = true;
    this.transitionError = '';

    this.projetSvc.transitionToPrototype(this.projet.id, bomFileId).subscribe({
      next: (updatedProjet) => {
        this.transitioning = false;
        this.showTransitionModal = false;
        this.showToast('Transition réussie ! Votre projet est maintenant en phase Prototype.');

        // Déterminer la redirection selon la détection des 4 fichiers depuis la Faisabilité
        const isPcbOnly = this.isPcbOnly;
        // Meme regle que l'ecran de depot : sinon le bandeau annoncait « Gerber
        // detecte » et la redirection renvoyait quand meme vers le depot.
        const hasGerber = aGerber(updatedProjet.documents);
        const hasPnp = aPickAndPlace(updatedProjet.documents);
        const hasBom = updatedProjet.bomUploaded || aBom(updatedProjet.documents);

        if (isPcbOnly) {
          if (hasGerber) {
            this.router.navigate(['/client/projets', updatedProjet.id]);
          } else {
            this.router.navigate(['/client/projets', updatedProjet.id, 'upload-gerber']);
          }
        } else {
          // PCBA : les trois pieces requises sont la (la SOP est optionnelle).
          // On ouvre la nomenclature, pas la fiche projet : c'est l'ecran ou
          // le travail continue — rapprochement avec le stock, alternatives,
          // puis validation. Renvoyer sur la fiche obligeait a la retrouver.
          if (hasGerber && hasPnp && hasBom) {
            this.router.navigate(['/client/projets', updatedProjet.id, 'bom']);
          } else {
            // Fichiers manquants (ex: Pick & Place ou SOP) -> Redirection automatique vers le dépôt technique
            this.router.navigate(['/client/projets', updatedProjet.id, 'upload-gerber']);
          }
        }
      },
      error: (err) => {
        this.transitioning = false;
        this.transitionError = err.error?.message || err.message || 'Erreur lors de la transition vers la phase Prototype.';
      }
    });
  }


  // ── Archive Modal Logic ──────────────────────────────────────
  showArchiveModal = false;
  selectedArchive: PhaseArchive | null = null;

  openArchiveModal(archive: PhaseArchive) {
    this.selectedArchive = archive;
    this.showArchiveModal = true;
  }

  closeArchiveModal() {
    this.showArchiveModal = false;
    this.selectedArchive = null;
  }

  // ═══════════════════════════════════════════════════
  // Chat Intégré au Projet
  // ═══════════════════════════════════════════════════

  /**
   * L'etat du fil : existe-t-il, et combien de messages.
   *
   * Une seule lecture, sans sondage. La conversation se lit maintenant en
   * pleine page, et c'est la qu'elle se rafraichit ; interroger le serveur
   * toutes les cinq secondes depuis la fiche projet ne servirait qu'a
   * reactualiser un compteur que personne ne regarde.
   *
   * L'absence de fil n'est pas une erreur : c'est simplement une discussion
   * que personne n'a encore ouverte, et le bouton propose de la demarrer.
   */
  loadLinkedTicketChat(projetId: string) {
    this.loadingChat = true;
    this.chatError = '';
    this.ticketSvc.getTicketByProjetId(projetId).subscribe({
      next: (ticket) => {
        this.linkedTicket = ticket;
        this.loadChatMessages(ticket.id, true);
        this.loadingChat = false;
      },
      error: () => {
        this.linkedTicket = null;
        this.chatMessages = [];
        this.loadingChat = false;
      }
    });
  }

  loadChatMessages(ticketId: string, silent = false) {
    if (!silent) this.loadingChat = true;
    this.ticketSvc.getProjectMessages(this.projet?.id || ticketId).subscribe({
      next: (messages) => {
        const isNewMessages = messages.length !== this.chatMessages.length;
        this.chatMessages = messages;
        this.loadingChat = false;
        if (isNewMessages) {
          this.shouldScrollChat = true;
        }
      },
      error: () => {
        this.loadingChat = false;
      }
    });
  }

  sendChatMessage() {
    if (!this.projet || !this.newChatMessage.trim()) return;
    this.sendingMessage = true;
    this.ticketSvc.addProjectMessage(this.projet!.id, { content: this.newChatMessage.trim() }, this.projet!.nom).subscribe({
      next: (msg) => {
        this.chatMessages.push(msg);
        this.newChatMessage = '';
        this.sendingMessage = false;
        this.shouldScrollChat = true;

        if (this.projet && (!this.projet.stage || this.projet.stage === 'EN_ATTENTE_CONTACT_SUPPORT')) {
          if (this.userRole === 'SUPPORT_TECHNIQUE') {
            this.projetSvc.startAnalysis(this.projet.id).subscribe(p => this.projet = p);
          }
        }
      },
      error: () => {
        this.sendingMessage = false;
      }
    });
  }

  isMyMessage(msg: Message): boolean {
    return msg.senderId === this.authSvc.currentUser?.id;
  }

  getSenderBadge(msg: Message): string {
    if (msg.senderRole === 'SUPPORT_TECHNIQUE') return '🛠️ Support';
    if (msg.senderRole === 'CHEF_DE_PROJET') return '📋 Chef de Projet';
    if (msg.senderRole === 'ADMINISTRATEUR' || msg.senderRole === 'ADMIN') return '⚙️ Admin';
    return '👤 Client';
  }

  // ═══════════════════════════════════════════════════
  // Fichiers Internes (Support Technique)
  // ═══════════════════════════════════════════════════

  onInternalFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedInternalFiles = Array.from(input.files);
    }
  }

  clearInternalFiles() {
    this.selectedInternalFiles = [];
  }

  uploadInternalFiles() {
    if (!this.projet || this.selectedInternalFiles.length === 0) return;
    this.uploadingInternalFiles = true;
    this.uploadInternalError = '';
    this.projetSvc.uploadFichiersInternes(this.projet.id, this.selectedInternalFiles).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.selectedInternalFiles = [];
        this.uploadingInternalFiles = false;
        this.showToast('Fichiers internes téléversés avec succès.');
      },
      error: (err) => {
        this.uploadingInternalFiles = false;
        this.uploadInternalError = err.error?.message || 'Erreur lors du téléversement des fichiers internes.';
      }
    });
  }

  hasInternalReport(): boolean {
    if (!this.projet || !this.projet.documents) return false;
    return this.projet.documents.some(d => d.typeDocument === 'DOCUMENT_INTERNE');
  }

  finaliserQualificationSupport() {
    if (!this.projet) return;
    if (!this.hasInternalReport()) {
      this.finalizeError = 'Veuillez d\'abord téléverser au moins un rapport de synthèse ou document interne avant de finaliser la qualification.';
      return;
    }
    this.finalizingSupport = true;
    this.finalizeError = '';
    this.projetSvc.finaliserQualificationSupport(this.projet.id).subscribe({
      next: (updated) => {
        this.projet = updated;
        this.loadProjet(updated.id);

        const markTicketResolved = (ticketId: string) => {
          this.ticketSvc.updateStatus(ticketId, 'RESOLU').subscribe({
            next: (updatedTicket) => {
              this.linkedTicket = updatedTicket;
              this.finalizingSupport = false;
              this.showToast('Qualification Support finalisée. Le ticket est marqué RÉSOLU !');
            },
            error: () => {
              this.finalizingSupport = false;
              this.showToast('Qualification Support finalisée. Le Chef de Projet prend la main !');
            }
          });
        };

        if (this.linkedTicket && this.linkedTicket.id) {
          markTicketResolved(this.linkedTicket.id);
        } else {
          // Attempt to find linked ticket by projetId if not yet set
          this.ticketSvc.getTicketByProjetId(updated.id).subscribe({
            next: (t) => {
              this.linkedTicket = t;
              if (t && t.id) {
                markTicketResolved(t.id);
              } else {
                this.finalizingSupport = false;
                this.showToast('Qualification Support finalisée. Le Chef de Projet prend la main !');
              }
            },
            error: () => {
              this.finalizingSupport = false;
              this.showToast('Qualification Support finalisée. Le Chef de Projet prend la main !');
            }
          });
        }
      },
      error: (err) => {
        this.finalizingSupport = false;
        this.finalizeError = err.error?.message || 'Erreur lors de la finalisation de la qualification.';
      }
    });
  }
  loadBillingData(projectId: string) {
    this.billingSvc.getContractByProject(projectId).subscribe({
      next: (c) => { this.projectContract = c; },
      error: () => { this.projectContract = null; }
    });
    this.billingSvc.getInvoicesByProject(projectId).subscribe({
      next: (invs) => { this.projectInvoices = invs; },
      error: () => { this.projectInvoices = []; }
    });
  }

  get isTranche1Paid(): boolean {
    const item1 = this.projectContract?.billingPlan?.find(b => b.sequence === 1);
    if (item1) return item1.status === 'PAID';
    const mainInv = this.projectInvoices[0];
    if (mainInv && mainInv.amountPaid > 0) return true;
    return this.projectContract?.status === 'ACTIVE' || this.projectContract?.status === 'COMPLETED';
  }

  get canCdpUploadValidationFiles(): boolean {
    const isValidationType = this.projet?.cadrage?.objectif === 'VALIDATION' || this.projet?.cadrage?.objectif === 'FAISABILITE' || this.projet?.cadrage?.objectif === 'IDEE';
    if (!isValidationType) return true;
    return this.isTranche1Paid;
  }

  get isTranche2Issued(): boolean {
    const item2 = this.projectContract?.billingPlan?.find(b => b.sequence === 2);
    if (item2) return item2.status === 'INVOICED' || item2.status === 'PAID';
    return this.projectInvoices.some(i => i.type === 'BALANCE');
  }

  get isTranche2Paid(): boolean {
    if (this.projet?.statut === 'COMPLETED' || this.projectContract?.status === 'COMPLETED') return true;
    const item2 = this.projectContract?.billingPlan?.find(b => b.sequence === 2);
    if (item2) return item2.status === 'PAID';
    const mainInv = this.projectInvoices[0];
    if (mainInv) return mainInv.status === 'PAID';
    return false;
  }

  downloadingSignedContract = false;

  viewSignedContract() {
    if (!this.projectContract) return;
    this.previewingSignedContract = true;
    this.billingSvc.downloadSignedContract(this.projectContract.id).subscribe({
      next: (blob) => {
        this.previewingSignedContract = false;
        const rawUrl = window.URL.createObjectURL(blob);
        this.previewSignedContractUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
      },
      error: (err) => {
        this.previewingSignedContract = false;
        alert("Erreur lors de l'ouverture du contrat signé : " + (err.error?.message || "Fichier introuvable"));
      }
    });
  }

  closeContractPreview() {
    this.previewSignedContractUrl = null;
  }

  downloadSignedContract() {
    if (!this.projectContract) return;
    this.downloadingSignedContract = true;
    this.billingSvc.downloadSignedContract(this.projectContract.id).subscribe({
      next: (blob) => {
        this.downloadingSignedContract = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contrat_signe_${this.projectContract?.contractNumber || this.projet?.nom}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.downloadingSignedContract = false;
        alert("Erreur lors du téléchargement du contrat signé : " + (err.error?.message || "Fichier introuvable"));
      }
    });
  }

  issueTranche2Invoice() {
    if (!this.projectContract) return;
    this.issuingTranche2 = true;
    this.billingSvc.issueBalanceInvoice(this.projectContract.id, this.projet?.nom).subscribe({
      next: (inv) => {
        this.issuingTranche2 = false;
        this.successMsg = 'Facture de Solde (Tranche 2 - 50%) émise avec succès (' + inv.invoiceNumber + ') ! Le client a été notifié pour règlement.';
        if (this.projet) {
          this.loadBillingData(this.projet.id);
          this.loadProjet(this.projet.id);
        }
      },
      error: (err) => {
        this.issuingTranche2 = false;
        alert('Erreur lors de l\'émission de la facture de solde: ' + (err.error?.message || 'Erreur'));
      }
    });
  }


  

  // ── Native Gerber Viewer (JLCPCB Style) ──
  openPcbViewer(doc?: DocumentProjet) {
    if (this.projet) {
      this.router.navigate(['/client/projets', this.projet.id, 'gerber-viewer']);
    }
  }

  // ── Réunions : Chargement ──
  loadProjectReunions(projetId: string) {
    this.loadingReunions = true;
    this.reunionSvc.getProjectReunions(projetId).subscribe({
      next: (list) => {
        this.projectReunions = list;
        this.loadingReunions = false;
      },
      error: () => { this.loadingReunions = false; }
    });
  }

  // ── Réunions : Ouvrir le scheduler modal ──
  openSchedulerModal() {
    console.log('Ouverture modal scheduler. Projet:', this.projet?.id, 'Chef:', this.chefProjetAssigneeId);
    this.showSchedulerModal = true;
  }

  // ── Réunions : Quand une réunion est planifiée depuis le modal ──
  onReunionScheduled(reunion: Reunion) {
    this.showSchedulerModal = false;
    this.projectReunions = [reunion, ...this.projectReunions];
    this.successMsg = `✅ Réunion "${reunion.titre}" planifiée avec succès !`;
    setTimeout(() => this.successMsg = '', 5000);
  }

  // ── Réunions : Rejoindre la visio ──
  joinMeeting(reunion: Reunion) {
    this.activeReunion = reunion;
    this.showMeetingRoomModal = true;
  }

  // ── Réunions : Annulation ──
  openCancelReunionConfirm(reunionId: string) {
    this.reunionToCancelId = reunionId;
    this.cancelMotif = '';
    this.showCancelReunionConfirm = true;
  }

  confirmCancelReunion() {
    if (!this.reunionToCancelId || !this.cancelMotif.trim()) return;
    this.cancelling = true;
    this.reunionSvc.annulerReunion(this.reunionToCancelId, { motif: this.cancelMotif }).subscribe({
      next: (updated) => {
        this.cancelling = false;
        this.showCancelReunionConfirm = false;
        this.projectReunions = this.projectReunions.map(r => r.id === updated.id ? updated : r);
        this.successMsg = 'Réunion annulée avec succès.';
        setTimeout(() => this.successMsg = '', 4000);
      },
      error: (err) => {
        this.cancelling = false;
        alert('Erreur annulation: ' + (err.error?.message || 'Erreur'));
      }
    });
  }

  // ── Réunions : Statut helpers ──
  getReunionStatusClass(statut: string): string {
    switch (statut) {
      case 'PLANIFIEE': return 'bg-primary/10 text-primary border-primary/20';
      case 'EN_COURS':  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'TERMINEE':  return 'bg-muted/20 text-muted-foreground border-border/20';
      case 'ANNULEE':   return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'REPORTEE':  return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:          return 'bg-secondary/20 text-foreground border-border/20';
    }
  }

  getReunionStatusLabel(statut: string): string {
    switch (statut) {
      case 'PLANIFIEE': return '📅 Planifiée';
      case 'EN_COURS':  return '🟢 En cours';
      case 'TERMINEE':  return '✅ Terminée';
      case 'ANNULEE':   return '❌ Annulée';
      case 'REPORTEE':  return '🔄 Reportée';
      default:          return statut;
    }
  }

  // Get first CHEF_DE_PROJET assignment userId
  // Get first CHEF_DE_PROJET assignment
  get chefProjetAssigneeId(): string | null {
    const assignments = this.getAssignments('CHEF_DE_PROJET');
    return assignments.length > 0 ? assignments[0].userId : null;
  }

  get chefProjetAssigneeNom(): string {
    const assignments = this.getAssignments('CHEF_DE_PROJET');
    return assignments.length > 0 ? (assignments[0].userNom || 'Chef de Projet') : 'Chef de Projet';
  }
}

