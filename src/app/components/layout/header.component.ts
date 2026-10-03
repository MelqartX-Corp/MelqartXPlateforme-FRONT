import { Component, inject, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription, interval } from 'rxjs';
import { ThemeService, AuthService, AdminNotificationService } from '../../services';
import { NotificationResponse } from '../../models';
import { environment } from '../../../environments/environment';
import { ChefAvailabilityModalComponent } from '../../modules/projet/components/chef-availability-modal.component';
import { TicketService } from '../../modules/ticket/services/ticket.service';
import { Ticket, ProjectDiscussion } from '../../modules/ticket/models/ticket.models';
import { CartService } from '../../modules/billing/services/cart.service';

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ChefAvailabilityModalComponent],
  styles: [`
    @keyframes iconSwap {
      0%   { transform: scale(0.6) rotate(-90deg); opacity: 0; }
      100% { transform: scale(1) rotate(0deg);    opacity: 1; }
    }
    .theme-icon { animation: iconSwap 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }

    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .dropdown-enter { animation: dropdownIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }

    .notif-dot {
      animation: notifBounce 2.5s ease-in-out 1.2s 1 both;
    }
    @keyframes notifBounce {
      0%, 100% { transform: scale(1); }
      30%       { transform: scale(1.35); }
      60%       { transform: scale(0.9); }
    }

    @keyframes toastFade {
      0% { opacity: 0; transform: translateY(10px); }
      15% { opacity: 1; transform: translateY(0); }
      85% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
    .toast-anim { animation: toastFade 3.5s ease-in-out forwards; }
  `],
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy {
  authService  = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private notifService = inject(AdminNotificationService);
  private cartService = inject(CartService);
  private ticketService = inject(TicketService);

  /**
   * Le compteur du panier, lu directement dans le service.
   *
   * Le badge, la page panier et le checkout regardent le meme etat : ajouter
   * une ligne depuis un devis met le compteur a jour sans que le header ait
   * quoi que ce soit a recharger.
   */
  cartCount = this.cartService.itemCount;

  breadcrumbs: BreadcrumbItem[] = [{ label: 'Accueil', url: '/dashboard' }];
  isDropdownOpen = false;
  isNotifOpen = false;
  showAvailabilityModal = false;
  notifications: NotificationResponse[] = [];
  notifCount = 0;
  /**
   * Le total rendu par le serveur, avant partage entre les deux icones.
   *
   * repartirLesPastilles() retranchait les messages de notifCount lui-meme, et
   * s'executait a deux endroits : le second retirait une seconde fois ce que
   * le premier avait deja retire, et la cloche tombait a zero.
   */
  private notifCountBrut = 0;
  loadingNotifs = false;
  activeTab: 'ALL' | 'PROJET' | 'BILLING' | 'STOCK' | 'TICKET' | 'SECURITY' = 'ALL';
  toastMessage: string | null = null;
  /** Libelle de l'action proposee dans le toast (ex. « Annuler ») */
  toastAction: string | null = null;
  private toastCallback: (() => void) | null = null;
  private toastTimer: any = null;

  /** Confirmation avant de vider toute la liste */
  showConfirmDeleteAll = false;
  private pollSub?: Subscription;

  private routeLabels: Record<string, string> = {
    'client':       'Espace Client',
    'projets':      'Projets',
    'creation':     'Nouveau Projet',
    'detail':       'Détail Projet',
    'validation':   'Validation',
    'cadrage':      'Cadrage Projet',
    'bom':          'Nomenclature (BOM)',
    'upload-gerber':'Fichiers Gerber',
    'gerber-viewer':'gerber-viewer',
    'quotes':       'Devis & Chiffrage',
    'orders':       'Mes commandes',
    'order':        'Mes commandes',
    'billing':      'Facturation',
    'invoices':     'Factures & Règlements',
    'panier':       'Mon Panier',
    'checkout':     'Paiement & Commande',
    'stock':        'Stock Composants',
    'reels':        'Bobines',
    'support':      'Support & Assistance',
    'tickets':      'Discussion Support',
    'profile':      'Mon Profil',
    'admin':        'Administration',
    'security':     'Sécurité',
    'assistant':    'Assistant IA'
  };

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.updateBreadcrumbs(e.urlAfterRedirects);
      if (e.urlAfterRedirects && e.urlAfterRedirects.includes('/discussions')) {
        this.marquerDiscussionsVues();
      }
    });
  }

  private onThemeChangeHandler = () => {};

  ngOnInit() {
    this.updateBreadcrumbs(this.router.url);
    if (this.router.url.includes('/discussions')) {
      this.marquerDiscussionsVues();
    }
    // Un technicien n'a pas de panier : on ne charge celui-ci que pour qui
    // peut commander, sinon chaque connexion interne declenche un 403 inutile.
    if (this.isLoggedIn && this.isClient && !this.lectureSeule) {
      this.cartService.load().subscribe({ error: () => {} });
    }
    if (this.isLoggedIn && this.aMessagerie) {
      this.chargerDiscussions();
    }
    if (this.isLoggedIn) {
      this.fetchNotifCount();
      // Les notifications sont lues des l'ouverture, pas seulement au clic sur
      // la cloche : c'est d'elles qu'on tire le compteur de messages.
      this.loadNotifications();
      this.pollSub = interval(25000).subscribe(() => {
        this.fetchNotifCount();
        this.loadNotifications();
        // La pastille de l'icone se lit sur les conversations : sans ce
        // rafraichissement elle restait figee sur l'etat du chargement initial.
        if (this.aMessagerie) {
          this.chargerDiscussions();
        }
      });
    }
    this.onThemeChangeHandler = () => {};
    window.addEventListener('melqart_avatar_theme_changed', this.onThemeChangeHandler);
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    window.removeEventListener('melqart_avatar_theme_changed', this.onThemeChangeHandler);
  }

  get isLoggedIn(): boolean { return this.authService.isLoggedIn(); }
  get isAdmin(): boolean    { return this.authService.role === 'ADMINISTRATEUR'; }
  /** Liste des discussions actives (pour le menu déroulant / modal) */
  discussions: ProjectDiscussion[] = [];
  discussionsOuvertes = 0;
  discussionsUnreadCount = 0;
  isDiscussionsOpen = false;
  loadingDiscussions = false;

  /** L'ingenieur consulte, il n'achete pas : pas de panier dans son en-tete. */
  get lectureSeule(): boolean { return this.authService.lectureSeule; }

  toggleDiscussionsDropdown(): void {
    this.isDiscussionsOpen = !this.isDiscussionsOpen;
    this.isNotifOpen = false;
    this.isDropdownOpen = false;
    if (this.isDiscussionsOpen) {
      // La liste ne se solde plus a l'ouverture : c'est justement la qu'il
      // faut voir lesquelles restent a lire. Chaque conversation se marque
      // quand on l'ouvre.
      this.chargerDiscussions();
    }
  }

  ouvrirDiscussion(d: ProjectDiscussion): void {
    this.isDiscussionsOpen = false;
    this.marquerDiscussionVue(d.projetId);
    const path = this.isClient
      ? `/client/discussions/${d.projetId}`
      : `/support/discussions/${d.projetId}`;
    this.router.navigateByUrl(path);
  }

  /**
   * Combien de messages restent a lire dans cette conversation.
   *
   * La bulle donnait un total sans dire d'ou il venait : on l'ouvrait, toutes
   * les conversations se ressemblaient, et il fallait les parcourir une a une
   * pour trouver celle qui avait bouge.
   */
  nonLusDe(d: ProjectDiscussion): number {
    return d.nonLus ?? 0;
  }

  /**
   * Solde une seule conversation, celle qu'on vient d'ouvrir.
   *
   * Le decompte qui fait foi est celui du serveur, remis a zero quand l'ecran
   * de la conversation en lit les messages. On le devance ici pour que la
   * pastille tombe des le clic, sans attendre le prochain rafraichissement.
   */
  private marquerDiscussionVue(projetId?: string): void {
    if (!projetId) return;

    const conversation = this.discussions.find(d => d.projetId === projetId);
    if (conversation) {
      conversation.nonLus = 0;
    }
    this.recompterDiscussions();

    // La copie deposee dans la cloche se lit avec, sinon elle y reste seule.
    this.notifications
      .filter(n => HeaderComponent.estMessage(n)
                && HeaderComponent.estNonLue(n)
                && (n.linkUrl ?? '').includes(projetId)
                && n.id)
      .forEach(n => {
        n.read = true;
        n.isRead = true;
        this.notifService.markAsRead(n.id).subscribe({ error: () => {} });
      });
  }

  /** La pastille de l'icone : la somme de ce que les conversations declarent. */
  private recompterDiscussions(): void {
    this.discussionsUnreadCount = this.discussions
      .reduce((total, d) => total + (d.nonLus ?? 0), 0);
  }

  voirToutesDiscussions(): void {
    this.isDiscussionsOpen = false;
    this.marquerDiscussionsVues();
    const path = this.isClient ? '/client/discussions' : '/support/discussions';
    this.router.navigateByUrl(path);
  }

  /**
   * Solde les copies deposees dans la cloche par les messages de projet.
   *
   * Ne touche pas a la pastille de l'icone : elle compte des conversations,
   * et passer devant leur liste n'en lit aucune. Elle tombait ici, a chaque
   * navigation vers /discussions — ouvrir la liste vidait la pastille de
   * messages qu'on n'avait jamais lus, et l'icone se taisait ensuite alors
   * que les fils, eux, en contenaient encore.
   *
   * Seules les notifications de message sont touchees — la cloche garde les
   * siennes.
   */
  marquerDiscussionsVues(): void {
    const aLire = this.notifications
      .filter(n => HeaderComponent.estMessage(n) && HeaderComponent.estNonLue(n) && n.id);

    aLire.forEach(n => {
      n.read = true;
      n.isRead = true;
      this.notifService.markAsRead(n.id).subscribe({ error: () => {} });
    });
  }

  /**
   * Une notification qui appartient a l'icone messagerie.
   *
   * Le type, et lui seul. Un detour par « linkUrl contient /discussions »
   * paraissait plus tolerant : il l'etait trop. Avant que le lien des tickets
   * ne soit corrige, une reponse de ticket de consultation pointait vers
   * « /client/discussions/<ticketId> » — ces lignes sont toujours en base, et
   * l'heuristique les faisait basculer dans la bulle. Le support repondait, la
   * cloche restait muette, et le message atterrissait dans une liste de
   * conversations ou il n'existe pas.
   *
   * PROJECT_MESSAGE_ADDED est emis par la conversation de projet, et par elle
   * seule. Tout le reste appartient a la cloche.
   */
  private static estMessage(n: NotificationResponse): boolean {
    return n.type === 'PROJECT_MESSAGE_ADDED';
  }

  /**
   * Non lue ?
   *
   * Le serveur declare le champ « isRead » ; Jackson le serialise « read »,
   * parce que le getter d'un booleen isRead s'appelle isRead(). Lire le seul
   * « isRead » renvoyait donc toujours undefined — et toute notification
   * passait pour non lue, a jamais. Les deux noms sont acceptes.
   */
  private static estNonLue(n: NotificationResponse): boolean {
    return !(n.read || n.isRead);
  }

  /**
   * Les notifications que la cloche doit montrer.
   *
   * Les messages en sortent : ils ont leur propre icone, et les laisser aux
   * deux endroits obligeait a les lire deux fois pour faire tomber les deux
   * pastilles.
   */
  get notificationsCloche(): NotificationResponse[] {
    return this.notifications.filter(n => !HeaderComponent.estMessage(n));
  }


  private chargerDiscussions(): void {
    this.loadingDiscussions = true;
    this.ticketService.getMesDiscussions(0, 50).subscribe({
      next: page => {
        // Aucun filtre de statut : une conversation n'en a pas.
        const list = page.content ?? [];
        this.discussions = list;
        this.discussionsOuvertes = list.length;
        this.recompterDiscussions();
        this.loadingDiscussions = false;
      },
      error: () => {
        this.discussions = [];
        this.discussionsOuvertes = 0;
        this.discussionsUnreadCount = 0;
        this.loadingDiscussions = false;
      }
    });
  }

  get isClient(): boolean   { return this.authService.role === 'CLIENT' || this.authService.role === 'CLIENT_ENTREPRISE' || this.authService.role === 'INGENIEUR'; }

  /**
   * Qui a une messagerie de projet.
   *
   * Le chef de projet et le support y repondent au client tous les jours ;
   * l'icone n'existait que cote client, et ils n'avaient aucun moyen de voir
   * qu'un message les attendait.
   *
   * L'administrateur en est exclu : il n'est l'interlocuteur d'aucun projet.
   * Lui poser une pastille pour des conversations qui ne l'attendent pas
   * l'aurait entraine a les ouvrir sans avoir rien a y repondre.
   */
  get aMessagerie(): boolean {
    const role = this.authService.role;
    return this.isClient
        || role === 'CHEF_DE_PROJET'
        || role === 'SUPPORT_TECHNIQUE';
  }
  get isCDP(): boolean      { return this.authService.role === 'CHEF_DE_PROJET'; }
  get isAppro(): boolean    { return this.authService.role === 'APPRO'; }
  get isSupport(): boolean  { return this.authService.role === 'SUPPORT_TECHNIQUE'; }

  get filteredNotifications(): NotificationResponse[] {
    const base = this.notificationsCloche;
    if (this.activeTab === 'ALL') return base;
    return base.filter(n => this.notifService.getCategory(n.type) === this.activeTab);
  }

  get categoryCounts() {
    const base = this.notificationsCloche;
    return {
      projet:   base.filter(n => this.notifService.getCategory(n.type) === 'PROJET').length,
      billing:  base.filter(n => this.notifService.getCategory(n.type) === 'BILLING').length,
      stock:    base.filter(n => this.notifService.getCategory(n.type) === 'STOCK').length,
      ticket:   base.filter(n => this.notifService.getCategory(n.type) === 'TICKET').length,
      security: base.filter(n => this.notifService.getCategory(n.type) === 'SECURITY').length
    };
  }

  private fetchNotifCount() {
    this.notifService.getUnreadCounts().subscribe({
      next: ({ total }) => {
        if (total > this.notifCountBrut) { this.playNotificationChime(); }
        this.notifCountBrut = total;
        this.repartirLesPastilles();
      },
      error: () => {}
    });
  }

  toggleNotifDropdown() {
    this.isNotifOpen = !this.isNotifOpen;
    this.isDropdownOpen = false;
    this.isDiscussionsOpen = false;
    if (this.isNotifOpen) {
      this.loadNotifications();
    }
  }

  private loadNotifications() {
    this.loadingNotifs = true;
    this.notifService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data;
        this.repartirLesPastilles();
        // Deja sur l'ecran des conversations : les messages arrivent lus.
        // Sans cela, la pastille remontait au rafraichissement suivant sous
        // les yeux d'un lecteur qui avait la conversation ouverte.
        if (this.router.url.includes('/discussions')) {
          this.marquerDiscussionsVues();
        }
        this.loadingNotifs = false;
      },
      error: () => this.loadingNotifs = false
    });
  }

  /**
   * Deux icones, deux comptes — et c'est le serveur qui les separe.
   *
   * Ce partage se faisait ici, en retranchant du total les messages trouves
   * dans « this.notifications ». Cette liste ne se charge qu'a l'ouverture de
   * la cloche : avant, elle etait vide, la bulle comptait zero et restait
   * muette meme avec des messages en attente. Le serveur rend desormais les
   * deux nombres, la cloche recevant deja son total net.
   */
  private repartirLesPastilles(): void {
    this.notifCount = this.notifCountBrut;
  }

  // ── QUICK ACTIONS HANDLERS ──

  onAcceptAlternatives(event: Event, n: NotificationResponse) {
    event.stopPropagation();
    const projectId = this.extractProjectId(n);
    if (!projectId) return;
    this.notifService.decideBomAlternatives(projectId, true).subscribe({
      next: () => {
        this.showToast('✅ Alternatives de composants acceptées avec succès !');
        this.markAsRead(n);
      },
      error: () => this.showToast('⚠️  Erreur lors de la validation des alternatives')
    });
  }

  onRefuseAlternatives(event: Event, n: NotificationResponse) {
    event.stopPropagation();
    const projectId = this.extractProjectId(n);
    if (!projectId) return;
    this.notifService.decideBomAlternatives(projectId, false).subscribe({
      next: () => {
        this.showToast('📦 Choix enregistré : Vous fournirez vos composants (DNP).');
        this.markAsRead(n);
      },
      error: () => this.showToast('⚠️  Erreur lors de l\'enregistrement')
    });
  }

  onCopyOvertimeCode(event: Event, n: NotificationResponse) {
    event.stopPropagation();
    const match = n.message.match(/code\s*:\s*([A-Z0-9]+)/i) || n.message.match(/([A-Z0-9]{6,8})/);
    const code = match ? match[1] : n.message;
    navigator.clipboard.writeText(code);
    this.showToast(`📋 Code ${code} copié dans le presse-papier !`);
    this.markAsRead(n);
  }

  onBlockUser(event: Event, n: NotificationResponse) {
    event.stopPropagation();
    const target = this.extractTargetUserIdentifier(n);
    if (!target) return;
    this.notifService.blockUser(target).subscribe({
      next: () => {
        this.showToast('🔒 Compte utilisateur bloqué avec succès.');
        this.markAsRead(n);
      },
      error: () => this.showToast('⚠️ Erreur lors du blocage')
    });
  }

  private extractTargetUserIdentifier(n: NotificationResponse): string | null {
    if (n.message) {
      const emailMatch = n.message.match(/\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)/);
      if (emailMatch && emailMatch[1]) {
        return emailMatch[1];
      }
    }
    if (n.linkUrl && n.linkUrl.includes('targetId=')) {
      const parts = n.linkUrl.split('targetId=');
      if (parts[1]) return parts[1];
    }
    return (n as any).targetUserId || n.userId || n.recipientUserId || null;
  }

  onNavigateAction(event: Event, n: NotificationResponse) {
    event.stopPropagation();
    this.markAsRead(n);
  }

  private showToast(msg: string, action?: { label: string; run: () => void }, dureeMs = 3500) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastAction = action ? action.label : null;
    this.toastCallback = action ? action.run : null;
    this.toastTimer = setTimeout(() => this.hideToast(), dureeMs);
  }

  private hideToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toastMessage = null;
    this.toastAction = null;
    this.toastCallback = null;
  }

  /** Declenche l'action du toast (le « Annuler » d'une suppression) */
  runToastAction() {
    const action = this.toastCallback;
    this.hideToast();
    if (action) action();
  }

  private extractProjectId(n: NotificationResponse): string | null {
    if (n.linkUrl && n.linkUrl.includes('/projet/')) {
      const parts = n.linkUrl.split('/');
      return parts[parts.length - 1];
    }
    const match = n.message.match(/#([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  private playNotificationChime() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  markAsRead(n: NotificationResponse) {
    if (!(n.read || n.isRead)) {
      this.notifService.markAsRead(n.id).subscribe({
        next: () => {
          n.read = true;
          n.isRead = true;
          this.notifCount = Math.max(0, this.notifCount - 1);
        }
      });
    }
    this.isNotifOpen = false;
    if (n.linkUrl) {
      this.router.navigateByUrl(this.lienPourMoi(n.linkUrl));
    }
  }

  /**
   * Le meme fil, mais a l'adresse de celui qui regarde.
   *
   * Une conversation notifie tous les participants avec un lien unique,
   * construit d'apres l'expediteur : quand le client ecrivait, l'equipe et le
   * client recevaient tous « /support/discussions/... ». Le client n'a pas
   * cette route, et son propre message le menait dans le vide.
   *
   * Le prefixe est donc reecrit ici, ou l'on sait qui ouvre — ce qui repare
   * aussi les notifications deja enregistrees.
   */
  private lienPourMoi(lien: string): string {
    if (!lien.includes('/discussions')) {
      return lien;
    }
    const mien = this.isClient ? '/client/discussions' : '/support/discussions';
    return lien
        .replace('/client/discussions', mien)
        .replace('/support/discussions', mien);
  }

  markAllAsRead() {
    this.notifService.markAllRead().subscribe({
      next: () => {
        this.notifications.forEach(n => { n.read = true; n.isRead = true; });
        this.notifCount = 0;
      }
    });
  }

  /**
   * Suppression douce : la notification quitte la liste de l'utilisateur courant.
   * Pas de confirmation — l'action est frequente et anodine ; elle est rattrapable
   * pendant quelques secondes via le « Annuler » du toast.
   */
  deleteNotification(event: Event, n: any) {
    event.stopPropagation();
    const position = this.notifications.findIndex(x => x.id === n.id);
    const etaitNonLue = !(n.read || n.isRead);

    this.notifService.delete(n.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(x => x.id !== n.id);
        if (etaitNonLue && this.notifCount > 0) this.notifCount--;
        this.showToast('Notification supprimée', {
          label: 'Annuler',
          run: () => this.restoreNotification(n, position, etaitNonLue)
        }, 6000);
      },
      error: () => this.showToast('Échec de la suppression')
    });
  }

  /** Remet la notification a sa place initiale dans la liste */
  private restoreNotification(n: any, position: number, etaitNonLue: boolean) {
    this.notifService.restore(n.id).subscribe({
      next: () => {
        const liste = [...this.notifications];
        liste.splice(position >= 0 ? position : liste.length, 0, n);
        this.notifications = liste;
        if (etaitNonLue) this.notifCount++;
      },
      error: () => this.showToast('Impossible de restaurer la notification')
    });
  }

  /** Ouvre la confirmation : vider la liste touche tout et n'est pas rattrapable */
  askDeleteAll() {
    this.showConfirmDeleteAll = true;
  }

  cancelDeleteAll() {
    this.showConfirmDeleteAll = false;
  }

  /** Vide la liste de l'utilisateur courant */
  deleteAllNotifications() {
    this.notifService.deleteAll().subscribe({
      next: () => {
        this.notifications = [];
        this.notifCount = 0;
        this.showConfirmDeleteAll = false;
        this.showToast('Toutes les notifications ont été supprimées');
      },
      error: () => {
        this.showConfirmDeleteAll = false;
        this.showToast('Échec de la suppression');
      }
    });
  }

  getNotifColor(type: string, alpha: number): string {
    const t = type.toUpperCase();
    if (t.includes('ALERT_OUT') || t.includes('REJECTED') || t.includes('CRITICAL')) return `hsl(var(--destructive)/${alpha})`;
    if (t.includes('SUSPICIOUS') || t.includes('SECURITY') || t.includes('BLOCKED')) return `hsl(var(--destructive)/${alpha})`;
    if (t.includes('ANNULATION') || t.includes('CANCELLED')) return `hsl(var(--warning)/${alpha})`;
    if (t.includes('WARNING') || t.includes('STOCK') || t.includes('AFTER_HOURS') || t.includes('ALTERNATIVES')) return `hsl(var(--warning)/${alpha})`;
    if (t.includes('ACCEPTED') || t.includes('SIGNED') || t.includes('RESOLVED') || t.includes('PAID') || t.includes('VALIDATED') || t.includes('GRANTED')) return `hsl(var(--success)/${alpha})`;
    if (t.includes('QUOTE') || t.includes('INVOICE') || t.includes('TRANCHE') || t.includes('PAYMENT')) return `hsl(var(--accent)/${alpha})`;
    if (t.includes('CAHIER') || t.includes('TECH_DOCS') || t.includes('REPORT')) return `hsl(var(--primary)/${alpha})`;
    return `hsl(var(--primary)/${alpha})`;
  }

  getNotifLabel(type: string): string {
    switch (type) {
      case 'NEW_DEVICE':                    return 'Nouvel appareil';
      case 'SUSPICIOUS_DEVICE':             return 'Alerte Suspect';
      case 'AFTER_HOURS_LOGIN':             return 'Hors heures';
      case 'OVERTIME_GRANTED':              return 'Overtime';
      case 'SECURITY_ADMIN_ALERT':          return 'Sécurité';
      case 'PROJET_STAGE_ALTERNATIVES':     return 'Alternatives BOM';
      case 'PROJET_CREATED':                return 'Nouveau Projet';
      case 'PROJET_ASSIGNED':               return 'Affectation';
      case 'PROJET_CAHIER_CHARGES':         return 'Cahier des Charges';
      case 'PROJET_TECH_DOCS':              return 'Fichiers Techniques';
      case 'PROJET_QUALIFICATION_COMPLETED':return 'Qualification OK';
      case 'PROJET_STAGE_REPORTS_READY':    return 'Rapport Essais';
      case 'BILLING_QUOTE_SENT':            return 'Devis Prêt';
      case 'BILLING_QUOTE_ACCEPTED':        return 'Devis Accepté';
      case 'BILLING_QUOTE_REJECTED':        return 'Devis Refusé';
      case 'BILLING_CONTRACT_SIGNED':       return 'Contrat Signé';
      case 'BILLING_INVOICE_ISSUED':        return 'Facture Émise';
      case 'BILLING_INVOICE_PAID':          return 'Règlement Reçu';
      case 'BILLING_TRANCHE1_ISSUED':       return 'Facture Acompte';
      case 'BILLING_TRANCHE1_PAID':         return 'Acompte Payé';
      case 'BILLING_TRANCHE2_ISSUED':       return 'Facture Solde';
      case 'BILLING_TRANCHE2_PAID':         return 'Solde Payé';
      case 'STOCK_ALERT_LOW':               return 'Stock Bas';
      case 'STOCK_ALERT_OUT':               return 'Rupture Totale';
      case 'TICKET_CREATED':                return 'Nouveau Ticket';
      case 'TICKET_REPLY_ADDED':            return 'Message Ticket';
      case 'PROJECT_MESSAGE_ADDED':         return 'Messagerie Projet';
      case 'TICKET_RESOLVED':               return 'Ticket Résolu';
      case 'INVITATION_ACCEPTED':           return 'Nouveau Membre';
      case 'INVITATION_SENT':               return 'Invitation';
      case 'WELCOME_INTERNAL':              return 'Bienvenue';
      case 'ORDER_PLACED':                  return 'Commande Reçue';
      case 'ORDER_PAID':                    return 'En Production';
      case 'ORDER_STAGE_CHANGED':           return 'Avancement';
      case 'ORDER_SHIPPED':                 return 'Expédiée';
      case 'PROJET_CANCELLED':              return 'Projet Annulé';
      case 'PROJET_ANNULATION_DEMANDEE':    return "Demande d'Annulation";
      case 'PROJET_ANNULATION_REFUSEE':     return 'Annulation Refusée';
      default:                              return type.replace(/_/g, ' ');
    }
  }

  getTimeAgo(date: string): string {
    if (!date) return '';
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
  }

  private updateBreadcrumbs(url: string) {
    if (!url) return;
    const cleanUrl = url.split('?')[0].split('#')[0];
    const allSegments = cleanUrl.split('/').filter(Boolean);
    let segments = [...allSegments];
    const isTicketRoute = url.includes('/tickets') || url.includes('/support');
    const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
    
    if (isTicketRoute) {
      if (segments.some(s => mongoIdRegex.test(s))) {
        const baseTicketUrl = this.isClient ? '/client/support' : '/support/tickets';
        this.breadcrumbs = [
          { label: 'Support & Assistance', url: baseTicketUrl },
          { label: 'Discussion Live' }
        ];
        return;
      }
    }

    // For internal users (Chef de projet, Admin, Support, etc.), remove 'client' or 'validator' prefix so breadcrumb shows 'Projets' directly
    let offset = 0;
    if (!this.isClient && segments[0] === 'client') {
      segments = segments.slice(1);
      offset = 1;
    }
    if (segments[0] === 'validator') {
      segments = segments.slice(1);
      offset = 1;
    }
    if (!this.isAdmin && !this.isAppro && segments[0] === 'stock') {
      segments = segments.slice(1);
      offset = 1;
    }
    
    this.breadcrumbs = segments.map((s, idx) => {
      const originalIdx = idx + offset;
      let label = this.routeLabels[s] || s;

      if (originalIdx > 0 && (allSegments[originalIdx - 1] === 'order' || allSegments[originalIdx - 1] === 'orders')) {
        label = 'Détails commande';
      } else if (mongoIdRegex.test(s)) {
        if (cleanUrl.includes('/order/') || cleanUrl.includes('/orders/')) {
          label = 'Détails commande';
        } else {
          label = 'Fiche Projet';
        }
      }

      // Compute navigation URL for clickable breadcrumbs
      let crumbUrl: string | undefined;
      const subPath = '/' + allSegments.slice(0, originalIdx + 1).join('/');

      if (s === 'client') {
        crumbUrl = '/client/dashboard';
      } else if (s === 'admin') {
        crumbUrl = '/admin/dashboard';
      } else if (s === 'validator') {
        crumbUrl = '/validator/dashboard';
      } else if (s === 'support') {
        crumbUrl = '/support/dashboard';
      } else if (s === 'projets' && offset === 1) {
        crumbUrl = '/client/projets';
      } else if (s === 'order') {
        crumbUrl = '/client/orders';
      } else {
        crumbUrl = subPath;
      }

      return { label, url: crumbUrl };
    });

    if (!this.breadcrumbs.length) {
      this.breadcrumbs = [{ label: 'Accueil', url: '/dashboard' }];
    }
  }

  get userName(): string {
    const user = this.authService.currentUser;
    return user ? `${user.prenom} ${user.nom}` : '';
  }
  get userEmail(): string { return this.authService.currentUser?.email ?? ''; }
  get userRole(): string  { return this.authService.role ?? ''; }
  get userInitials(): string {
    const user = this.authService.currentUser;
    if (!user) return '';
    return `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}` || '?';
  }
  get avatarUrl(): string {
    const user = this.authService.currentUser;
    if (!user) return '';
    if (user.profileImage) return user.profileImage;
    if (user.role === 'CLIENT_ENTREPRISE' && user.organisation?.logo) return user.organisation.logo;
    return '';
  }

  get avatarGradient(): string {
    const user = this.authService.currentUser;
    const theme = (user?.email && localStorage.getItem('melqart_avatar_theme_' + user.email)) || localStorage.getItem('melqart_avatar_theme_default');
    return theme || 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)';
  }

  toggleDropdown() { this.isDropdownOpen = !this.isDropdownOpen; this.isNotifOpen = false; this.isDiscussionsOpen = false; }
  closeDropdown()  { this.isDropdownOpen = false; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('#profileMenu')) this.isDropdownOpen = false;
    if (!target.closest('#notifMenu')) this.isNotifOpen = false;
    if (!target.closest('#discussionsMenu')) this.isDiscussionsOpen = false;
  }

  handleLogout() {
    this.closeDropdown();
    this.authService.logout();
  }
}