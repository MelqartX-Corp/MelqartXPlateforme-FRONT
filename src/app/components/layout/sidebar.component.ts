import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService, AdminNotificationService } from '../../services';
import { NotificationResponse } from '../../models';

interface NavItem {
  title: string;
  icon: string;
  path: string;
}

interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [`
    .nav-link {
      position: relative;
      overflow: hidden;
    }
    .nav-link::before {
      content: '';
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%) scaleY(0);
      width: 3px;
      height: 70%;
      border-radius: 0 4px 4px 0;
      background: hsl(var(--sidebar-primary));
      transition: transform 0.22s ease;
    }
    .nav-link-active::before {
      transform: translateY(-50%) scaleY(1);
    }
    .nav-link:hover .nav-icon {
      transform: scale(1.1);
    }
    .nav-icon {
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes logoGrad {
      0%   { filter: hue-rotate(0deg); }
      50%  { filter: hue-rotate(20deg) brightness(1.1); }
      100% { filter: hue-rotate(0deg); }
    }
    .logo-icon { animation: logoGrad 6s ease-in-out infinite; }
    .version-pulse { animation: pulse 3s ease-in-out infinite; }

    /* Label fade-in when expanded */
    .sidebar-label {
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .sidebar-label-hidden {
      opacity: 0;
      transform: translateX(-6px);
      pointer-events: none;
      width: 0;
      overflow: hidden;
    }
    .sidebar-label-visible {
      opacity: 1;
      transform: translateX(0);
    }

    /* Sidebar hover glow on the border */
    aside:hover {
      box-shadow:
        4px 0 32px -4px hsl(var(--sidebar-primary) / 0.18),
        2px 0 8px -2px hsl(var(--sidebar-primary) / 0.10);
    }

    /* ─€─€─€ Accordion group ─€─€─€ */
    .group-header {
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }
    .group-header:hover {
      background: hsl(var(--sidebar-accent) / 0.4);
    }
    .group-chevron {
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .group-chevron-open {
      transform: rotate(180deg);
    }
    .group-children {
      overflow: hidden;
      transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.25s ease;
    }
    .group-children-closed {
      max-height: 0;
      opacity: 0;
    }
    .group-children-open {
      max-height: 500px;
      opacity: 1;
    }
    .group-active-bar {
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 2px;
      border-radius: 0 3px 3px 0;
      background: hsl(var(--sidebar-primary) / 0.5);
      transition: opacity 0.2s ease;
    }
  `],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private notifService = inject(AdminNotificationService);
  private notifications: NotificationResponse[] = [];

  getItemBadge(item: NavItem): { count: number; color: string } | null {
    if (!this.notifications.length) return null;
    const path = item.path.toLowerCase();
    let category = '';
    if (path.includes('projet') || path.includes('validation')) category = 'PROJET';
    else if (path.includes('billing') || path.includes('quote') || path.includes('order') || path.includes('facture')) category = 'BILLING';
    else if (path.includes('stock')) category = 'STOCK';
    else if (path.includes('ticket') || path.includes('support')) category = 'TICKET';
    else if (path.includes('security') || path.includes('session') || path.includes('blocked')) category = 'SECURITY';

    if (!category) return null;
    const unread = this.notifications.filter(n => !(n.read || n.isRead) && this.notifService.getCategory(n.type) === category).length;
    if (unread === 0) return null;

    let color = 'hsl(var(--primary))';
    if (category === 'SECURITY') color = 'hsl(var(--destructive))';
    if (category === 'STOCK') color = 'hsl(var(--warning))';
    if (category === 'BILLING') color = 'hsl(var(--accent))';
    return { count: unread, color };
  }
  currentUrl = signal<string>('');

  pinned = signal<boolean>(false);
  hovered = signal<boolean>(false);
  collapsed = signal<boolean>(true);
  isExpanded = computed(() => this.pinned() || this.hovered());

  /** Accordion group open state */
  groupOpen = signal<boolean>(false);
  usersGroupOpen = signal<boolean>(false);
  stockGroupOpen = signal<boolean>(false);

  constructor() {
    this.currentUrl.set(this.router.url);
    this.notifService.notifications$.subscribe((notifs: any) => this.notifications = notifs);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentUrl.set(event.urlAfterRedirects);
      // Auto-open groups if navigated to a child route
      if (this.isGroupActive()) {
        this.groupOpen.set(true);
      }
      if (this.isUsersGroupActive()) {
        this.usersGroupOpen.set(true);
      }
      if (this.isStockGroupActive()) {
        this.stockGroupOpen.set(true);
      }
    });

    // Auto-open on init if current route is inside a group
    setTimeout(() => {
      if (this.isGroupActive()) {
        this.groupOpen.set(true);
      }
      if (this.isUsersGroupActive()) {
        this.usersGroupOpen.set(true);
      }
      if (this.isStockGroupActive()) {
        this.stockGroupOpen.set(true);
      }
    });
  }

  togglePin() {
    this.pinned.set(!this.pinned());
    this.collapsed.set(!this.pinned());
  }

  toggleGroup() {
    this.groupOpen.set(!this.groupOpen());
  }

  toggleUsersGroup() {
    this.usersGroupOpen.set(!this.usersGroupOpen());
  }

  toggleStockGroup() {
    this.stockGroupOpen.set(!this.stockGroupOpen());
  }

  isItemActive(item: NavItem): boolean {
    const url = this.currentUrl();
    if (item.path === '/client/support' && (url.startsWith('/client/support') || url.startsWith('/support/tickets'))) {
      return true;
    }
    if (item.path === '/support/tickets' && url.startsWith('/support/tickets')) {
      return true;
    }
    if (item.path === '/client/projets' && url.startsWith('/client/projets')) {
      return true;
    }
    if (item.path === '/validator/invoices' && url.startsWith('/validator/invoices')) {
      return true;
    }
    if (item.path === '/validator/quotes' && url.startsWith('/validator/quotes')) {
      return true;
    }
    if (item.path === '/admin/billing/catalog' && url.startsWith('/admin/billing/catalog')) {
      return true;
    }
    if (item.path === '/admin/billing/atelier' && url.startsWith('/admin/billing/atelier')) {
      return true;
    }
    if (item.path === '/client/billing/invoices' && url.startsWith('/client/billing/invoices')) {
      return true;
    }
    if (item.path === '/support/discussions' && url.startsWith('/support/discussions')) {
      return true;
    }
    if (item.path === '/client/discussions' && url.startsWith('/client/discussions')) {
      return true;
    }
    if (item.path === '/client/billing/quotes' && url.startsWith('/client/billing/quotes')) {
      return true;
    }
    if (item.path === '/admin/dashboard' && url === '/admin/dashboard') {
      return true;
    }
    return url === item.path || (item.path !== '/' && url.startsWith(item.path + '/'));
  }

  isRoute(routeBase: string): boolean {
    return this.currentUrl().startsWith(routeBase);
  }

  /** Check if any child of the "Gestion des comptes" group is active */
  isGroupActive(): boolean {
    const group = this.accountGroup();
    if (!group) return false;
    return group.children.some(c => this.currentUrl().startsWith(c.path));
  }

  /** Check if any child of the "Utilisateurs" group is active */
  isUsersGroupActive(): boolean {
    const group = this.usersGroup();
    if (!group) return false;
    return group.children.some(c => this.currentUrl().startsWith(c.path));
  }

  /** Number of active children (for collapsed badge) */
  activeGroupChildCount = computed(() => {
    const group = this.accountGroup();
    if (!group) return 0;
    return group.children.filter(c => this.currentUrl().startsWith(c.path)).length;
  });

  roleTitle = computed(() => {
    const role = this.authService.role;
    switch (role) {
      case 'ADMINISTRATEUR':       return 'Administration';
      case 'CLIENT':               return 'Espace Client';
      case 'CLIENT_ENTREPRISE':    return 'Espace Entreprise';
      case 'SUPPORT_TECHNIQUE':    return 'Support';
      case 'CHEF_DE_PROJET': return 'Chef de Projet';
      case 'TECHNICIEN':           return 'Atelier';
      case 'APPRO':                return 'Approvisionnement';
      case 'INGENIEUR':             return 'Espace Ingénieur';
      default:                     return 'Menu Principal';
    }
  });

  /** Items ABOVE the accordion group, par rôle */
  private roleTopItems = computed<NavItem[]>(() => {
    const role = this.authService.role;
    if (role === 'ADMINISTRATEUR') {
      return [
        { title: 'Tableau de bord',    icon: 'dashboard',    path: '/admin/dashboard' },
        { title: 'Production',          icon: 'kanban',       path: '/production' },
        { title: 'Avis clients',        icon: 'star',         path: '/admin/feedback' },
      ];
    }
    if (role === 'SUPPORT_TECHNIQUE') {
      return [
        { title: 'Tableau de bord',     icon: 'dashboard',    path: '/support/dashboard' },
        { title: 'Tickets',             icon: 'headphones',   path: '/support/tickets' },
        { title: 'Discussions',         icon: 'message-circle', path: '/support/discussions' },
        { title: 'Workspace Projets',  icon: 'kanban',       path: '/client/projets' }
      ];
    }
    if (role === 'TECHNICIEN') {
      return [
        { title: 'Mon atelier',         icon: 'dashboard',    path: '/technicien/dashboard' },
        { title: 'Production',          icon: 'kanban',       path: '/production' },
        // L'atelier a besoin de voir où sont les bobines avant d'aller les
        // chercher : sans cet accès, il ouvrait une bobine neuve pour des
        // pièces déjà présentes sur une machine.
        { title: 'Bobines',             icon: 'package',      path: '/stock/reels' },
      ];
    }
    if (role === 'CHEF_DE_PROJET') {
      return [
        { title: 'Tableau de bord',     icon: 'dashboard',    path: '/validator/dashboard' },
        { title: 'Planning & Réunions', icon: 'calendar',     path: '/validator/calendar' },
        { title: 'Workspace Projets',  icon: 'kanban',       path: '/client/projets' },
        // Le chef de projet peut ecrire dans les canaux de ses projets : il lui
        // manquait l'entree pour y aller.
        { title: 'Discussions',         icon: 'message-circle', path: '/support/discussions' },
        { title: 'Production',          icon: 'layers',       path: '/production' },
        { title: 'Élaborer un Devis',   icon: 'dollar',       path: '/validator/quotes' },
        { title: 'Factures Émises',     icon: 'file-text',    path: '/validator/invoices' },
        // « Avis clients » retiré : la page classe les chefs de projet entre eux,
        // elle est réservée à l'administrateur.
      ];
    }
    // L'appro vit dans le stock : c'est son metier entier, pas une rubrique
    // parmi d'autres. Replier ses pages sous un accordeon « Gestion de Stock »
    // lui coutait un clic sur chaque ecran de sa journee — l'accordeon reste
    // pour l'administrateur, qui n'y passe que de temps en temps.
    if (role === 'APPRO' || this.isRoute('/appro')) {
      return [
        { title: 'Tableau de bord',         icon: 'dashboard',   path: '/appro/dashboard' },
        { title: 'Catalogue de composants', icon: 'cpu',         path: '/stock/components' },
        { title: 'Fournisseurs',            icon: 'building',    path: '/stock/suppliers' },
        { title: 'Lots',                    icon: 'layers',      path: '/stock/lots' },
        { title: 'Emplacements',            icon: 'map-pin',     path: '/stock/locations' },
        { title: 'Bobines',                 icon: 'circle-dot',  path: '/stock/reels' },
      ];
    }
    // L'ingenieur est un collaborateur invite par un client entreprise : il
    // travaille sur les projets de cette societe, il ne les achete pas. Son
    // menu est donc celui du client entreprise, moins tout ce qui engage de
    // l'argent — devis, panier, factures. Ce qui reste se lit.
    if (role === 'INGENIEUR') {
      return [
        { title: 'Tableau de bord',  icon: 'dashboard',   path: '/client/dashboard' },
        { title: 'Mes projets',      icon: 'kanban',      path: '/client/projets' },
        { title: 'Mes commandes',    icon: 'truck',       path: '/client/orders' },
        { title: 'Mes discussions',  icon: 'message-circle', path: '/client/discussions' },
        { title: 'Support',          icon: 'headphones',  path: '/client/support' },
      ];
    }
    return [
      { title: 'Tableau de bord',  icon: 'dashboard',   path: '/client/dashboard' },
      { title: 'Mes projets',      icon: 'kanban',      path: '/client/projets' },
      { title: 'Mes devis',        icon: 'file-text',   path: '/client/billing/quotes' },
      { title: 'Mon panier',       icon: 'shopping-cart', path: '/client/panier' },
      { title: 'Mes commandes',    icon: 'truck',       path: '/client/orders' },
      { title: 'Mes factures',     icon: 'dollar',      path: '/client/billing/invoices' },
      // Deux entrees, deux natures : une question sur un projet accompagne une
      // etude, une reclamation signale un incident. Les melanger noierait la
      // seconde sous la premiere.
      { title: 'Mes discussions',  icon: 'message-circle', path: '/client/discussions' },
      { title: 'Support',          icon: 'headphones',  path: '/client/support' },
      // Gerer ses collaborateurs n'a de sens que pour une societe : un client
      // particulier est seul sur ses projets. La page existait deja, mais
      // aucune entree de menu n'y menait — seule l'adresse tapee a la main
      // l'ouvrait, et elle s'ouvrait pour n'importe quel client.
      ...(role === 'CLIENT_ENTREPRISE'
        ? [{ title: 'Mes collaborateurs', icon: 'users', path: '/client/organisation' }]
        : []),
    ];
  });

  /** Items réellement affichés : ceux du rôle + l'Assistant (externes & admin uniquement). */
  topItems = computed<NavItem[]>(() => {
    const items = [...this.roleTopItems()];
    const role = this.authService.role;
    // L'assistant IA n'est utile qu'aux clients et à l'administrateur ;
    // les collaborateurs internes n'en ont pas besoin dans leur workflow.
    if (role === 'CLIENT' || role === 'CLIENT_ENTREPRISE' || role === 'INGENIEUR' || role === 'ADMINISTRATEUR') {
      items.push({ title: 'Assistant IA', icon: 'sparkles', path: '/assistant' });
    }
    return items;
  });

  /**
   * Le côté client de l'annuaire : les comptes externes et les organisations
   * auxquelles ils appartiennent. Les deux se lisent ensemble — on arrive sur
   * un client, on veut sa société, et inversement.
   *
   * Les comptes internes restent dans « Gestion des comptes », avec le reste
   * de l'administration des collaborateurs.
   */
  usersGroup = computed<NavGroup | null>(() => {
    const role = this.authService.role;
    if (role === 'ADMINISTRATEUR' || this.isRoute('/admin')) {
      return {
        label: 'Utilisateurs',
        icon: 'users',
        children: [
          { title: 'Utilisateurs externes', icon: 'user',     path: '/admin/users-externes' },
          { title: 'Organisations',         icon: 'building', path: '/admin/organisations' },
        ]
      };
    }
    return null;
  });

  /** The accordion group — only for admin role */
  accountGroup = computed<NavGroup | null>(() => {
    const role = this.authService.role;
    if (role === 'ADMINISTRATEUR' || this.isRoute('/admin')) {
      return {
        label: 'Gestion des comptes',
        icon: 'users',
        children: [
          { title: 'Utilisateurs internes', icon: 'users',      path: '/admin/users' },
          { title: 'Sessions Actives',    icon: 'activity',     path: '/admin/sessions' },
          { title: 'Sécurité / Blocages', icon: 'shield-alert', path: '/admin/blocked-users' },
          { title: 'Heures Supp.',        icon: 'clock',        path: '/admin/overtime' },
        ]
      };
    }
    return null;
  });

  /** Items BELOW the accordion group */
  bottomItems = computed<NavItem[]>(() => {
    const role = this.authService.role;
    if (role === 'ADMINISTRATEUR' || this.isRoute('/admin')) {
      return [
        { title: 'Workspace Projets',   icon: 'kanban',       path: '/client/projets' },
        { title: 'Catalogue Services',  icon: 'layers',       path: '/admin/billing/catalog' },
        { title: 'Reglages Atelier',    icon: 'sparkles',     path: '/admin/billing/atelier' },
        { title: 'Élaborer un Devis',   icon: 'dollar',       path: '/validator/quotes' },
        { title: 'Factures Émises',     icon: 'file-text',    path: '/validator/invoices' },
        { title: 'Livraison',           icon: 'truck',        path: '/admin/shipping' },
      ];
    }
    // Other roles: no bottom items (all are in topItems)
    return [];
  });

  /**
   * Groupe « Gestion de Stock » — administrateur seulement.
   *
   * L'appro a les memes pages, mais a plat dans son menu principal : le stock
   * est son poste de travail, pas un dossier qu'il ouvre. Les lui replier ici
   * ajouterait un clic a chaque ecran, tous les jours.
   */
  stockItems = computed<NavItem[]>(() => {
    const role = this.authService.role;
    if (role !== 'ADMINISTRATEUR') return [];
    return [
      { title: 'Stock Dashboard',  icon: 'package',    path: '/stock' },
      { title: 'Catalogue de composants', icon: 'cpu', path: '/stock/components' },
      { title: 'Fournisseurs',     icon: 'building',   path: '/stock/suppliers' },
      { title: 'Lots',             icon: 'layers',     path: '/stock/lots' },
      { title: 'Emplacements',     icon: 'map-pin',    path: '/stock/locations' },
      { title: 'Bobines',          icon: 'circle-dot', path: '/stock/reels' },
    ];
  });

  isStockGroupActive(): boolean {
    return this.stockItems().some(item => this.currentUrl().startsWith(item.path));
  }
}
