import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'features', pathMatch: 'full' },

  // Page vitrine — accessible à tous (connectés ou non)
  { path: 'features', loadComponent: () => import('./pages/features-showcase/features-showcase.component').then(m => m.FeaturesShowcaseComponent) },
  // Politique de confidentialité — publique : Google exige ce lien pour publier l'écran de consentement OAuth
  { path: 'confidentialite', loadComponent: () => import('./pages/confidentialite/confidentialite.component').then(m => m.ConfidentialiteComponent) },
  // Pages d'auth — guestGuard redirige vers /dashboard si déjà connecté
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent), canActivate: [guestGuard] },
  { path: 'register-enterprise', loadComponent: () => import('./pages/register-enterprise/register-enterprise.component').then(m => m.RegisterEnterpriseComponent), canActivate: [guestGuard] },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent), canActivate: [guestGuard] },
  // Pages sans guard — utilisées pendant le processus d'auth en cours
  { path: 'verify-email', loadComponent: () => import('./pages/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
  { path: 'verify-otp', loadComponent: () => import('./pages/verify-otp/verify-otp.component').then(m => m.VerifyOtpComponent) },
  { path: 'oauth2/callback', loadComponent: () => import('./pages/oauth2-callback/oauth2-callback.component').then(m => m.Oauth2CallbackComponent) },
  { path: 'google-meet/callback', loadComponent: () => import('./pages/google-meet-callback/google-meet-callback.component').then(m => m.GoogleMeetCallbackComponent) },
  { path: 'accept-invitation', loadComponent: () => import('./pages/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent) },
  { path: 'set-password', loadComponent: () => import('./pages/set-password/set-password.component').then(m => m.SetPasswordComponent) },

  // Dashboard router (redirection hub based on role)
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard-router/dashboard-router.component').then(m => m.DashboardRouterComponent), canActivate: [authGuard] },

  // App Layout wrapper for authorized routes
  {
    path: '',
    loadComponent: () => import('./components/layout/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [authGuard],
    children: [
      // Client pages
      { path: 'client/dashboard', loadComponent: () => import('./pages/client/dashboard/dashboard.component').then(m => m.ClientDashboardComponent) },
      { path: 'client/quotes', loadComponent: () => import('./pages/client/quotes/quotes.component').then(m => m.ClientQuotesComponent) },
      { path: 'client/new-quote', loadComponent: () => import('./pages/client/new-quote/new-quote.component').then(m => m.ClientNewQuoteComponent) },
      { path: 'client/orders', loadComponent: () => import('./modules/billing/pages/client-orders/client-orders.component').then(m => m.ClientOrdersComponent) },
      { path: 'client/order', redirectTo: 'client/orders', pathMatch: 'full' },
      { path: 'client/order/:id', loadComponent: () => import('./modules/billing/pages/client-order-detail/client-order-detail.component').then(m => m.ClientOrderDetailComponent) },
      { path: 'client/panier', loadComponent: () => import('./modules/billing/pages/client-cart/client-cart.component').then(m => m.ClientCartComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      { path: 'client/checkout', loadComponent: () => import('./modules/billing/pages/client-checkout/client-checkout.component').then(m => m.ClientCheckoutComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      // Inviter et retirer des collaborateurs engage la société : seul le
      // compte entreprise en dispose. Sans ce garde, un client particulier
      // ouvrait la page en tapant l'adresse.
      { path: 'client/organisation', loadComponent: () => import('./pages/client/organisation/organisation.component').then(m => m.ClientOrganisationComponent), canActivate: [roleGuard('CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      
      // Client Billing pages (ms-billing)
      { path: 'client/billing/quotes', loadComponent: () => import('./modules/billing/pages/client-quotes/client-quotes.component').then(m => m.ClientQuotesComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      { path: 'client/billing/invoices', loadComponent: () => import('./modules/billing/pages/client-invoices/client-invoices.component').then(m => m.ClientInvoicesComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      { path: 'client/billing/pay/:invoiceId', loadComponent: () => import('./modules/billing/pages/client-payment/client-payment.component').then(m => m.ClientPaymentComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },

      { path: 'client/support', loadComponent: () => import('./modules/ticket/pages/ticket-list/ticket-list.component').then(m => m.TicketListComponent) },
      // Meme composant, autre lecture : le type vient de la route. Deux
      // entrees pour le client — une question sur son projet et une
      // reclamation ne se rangent pas au meme endroit — et une seule page a
      // maintenir.
      // Les conversations de projet ont leur ecran : elles n'ont ni statut ni
      // priorite, et la liste des tickets ne sait afficher que des dossiers.
      { path: 'client/discussions', loadComponent: () => import('./modules/ticket/pages/discussions-list/discussions-list.component').then(m => m.DiscussionsListComponent) },
      { path: 'client/support/:id', loadComponent: () => import('./modules/ticket/pages/ticket-chat/ticket-chat.component').then(m => m.TicketChatComponent) },
      // Même écran, même fil, même messagerie : seul le vocabulaire change.
      // Une question sur un projet n'est pas une réclamation, et le client ne
      // devrait pas lire « ticket », « priorité » ni « résolu » pour la poser.
      { path: 'client/discussions/:projetId', loadComponent: () => import('./modules/ticket/pages/project-chat/project-chat.component').then(m => m.ProjectChatComponent) },

      // Client project pages (ms-projet)
      { path: 'client/projets', loadComponent: () => import('./modules/projet/pages/projet-list/projet-list.component').then(m => m.ProjetListComponent) },
      { path: 'client/projets/new', loadComponent: () => import('./modules/projet/pages/projet-create/projet-create.component').then(m => m.ProjetCreateComponent), canActivate: [roleGuard('CLIENT', 'CLIENT_ENTREPRISE', 'ADMINISTRATEUR')] },
      { path: 'client/projets/:id/cadrage', loadComponent: () => import('./modules/projet/pages/projet-cadrage/projet-cadrage.component').then(m => m.ProjetCadrageComponent) },
      { path: 'client/projets/:id/bom', loadComponent: () => import('./modules/projet/pages/projet-bom/projet-bom.component').then(m => m.ProjetBomComponent) }, // dedicated bom page
      { path: 'client/projets/:id/upload-gerber', loadComponent: () => import('./modules/projet/pages/projet-upload-gerber/projet-upload-gerber.component').then(m => m.ProjetUploadGerberComponent) }, // dedicated gerber upload page for pcb only
      { path: 'client/projets/:id/gerber-viewer', loadComponent: () => import('./modules/projet/pages/projet-gerber-viewer/projet-gerber-viewer.component').then(m => m.ProjetGerberViewerComponent) }, // dedicated 2D/3D CAD gerber viewer
      { path: 'client/projets/:id', loadComponent: () => import('./modules/projet/pages/projet-detail/projet-detail.component').then(m => m.ProjetDetailComponent) },

      // Admin pages (role-protected)
      { path: 'admin/dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      
      // Admin Billing pages
      { path: 'admin/billing', loadComponent: () => import('./modules/billing/pages/admin-billing-dashboard/admin-billing-dashboard.component').then(m => m.AdminBillingDashboardComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/billing/catalog', loadComponent: () => import('./modules/billing/pages/admin-catalog/admin-catalog.component').then(m => m.AdminCatalogComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/billing/atelier', loadComponent: () => import('./modules/billing/pages/admin-manufacturing-params/admin-manufacturing-params.component').then(m => m.AdminManufacturingParamsComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },

      // Internes et externes partagent la même page : mêmes colonnes, mêmes
      // actions, mêmes filtres. Seule la source change, et elle est portée par
      // la route — un second composant n'aurait fait que dupliquer l'écran.
      { path: 'admin/users', data: { userCategory: 'internal' }, loadComponent: () => import('./pages/admin/users/users.component').then(m => m.AdminUsersComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/users-externes', data: { userCategory: 'external' }, loadComponent: () => import('./pages/admin/users/users.component').then(m => m.AdminUsersComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/organisations', loadComponent: () => import('./pages/admin/organisations/organisations.component').then(m => m.OrganisationsComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/quotes-orders', loadComponent: () => import('./pages/admin/quotes-orders/quotes-orders.component').then(m => m.AdminQuotesOrdersComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/pricing', loadComponent: () => import('./pages/admin/pricing/pricing.component').then(m => m.PricingComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/shipping', loadComponent: () => import('./modules/billing/pages/admin-shipping/admin-shipping.component').then(m => m.AdminShippingComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },

      // Le devis d'un projet, sur sa propre page : c'est la destination
      // naturelle juste apres la validation de la BOM.
      { path: 'projets/:id/devis', loadComponent: () => import('./modules/billing/pages/devis-projet/devis-projet.component').then(m => m.DevisProjetComponent) },

      // Le technicien avait pour tableau de bord celui du client : des devis
      // qu'il n'achete pas et des factures qui ne le concernent pas. Le sien
      // ne parle que d'atelier — sa charge, ses urgences, ses bobines.
      { path: 'technicien/dashboard', loadComponent: () => import('./pages/technicien/dashboard/dashboard.component').then(m => m.TechnicienDashboardComponent), canActivate: [roleGuard('TECHNICIEN', 'ADMINISTRATEUR')] },

      { path: 'production', loadComponent: () => import('./pages/admin/production/production.component').then(m => m.ProductionComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'TECHNICIEN', 'CHEF_DE_PROJET')] },
      // La preparation des bobines est un poste de travail, pas une fenetre :
      // elle a sa page, son adresse partageable et son propre rechargement.
      { path: 'production/:orderId/kitting', loadComponent: () => import('./pages/admin/production/kitting/kitting.component').then(m => m.ProductionKittingComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'TECHNICIEN', 'CHEF_DE_PROJET')] },
      // L'origine des pieces montees sur les cartes d'un projet : quel lot,
      // quel fournisseur, quelle bobine. Le journal existait depuis le premier
      // retour de production, aucun ecran ne le lisait.
      { path: 'production/:orderId/tracabilite/:projetId', loadComponent: () => import('./modules/stock/pages/project-traceability/project-traceability.component').then(m => m.ProjectTraceabilityComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'TECHNICIEN', 'CHEF_DE_PROJET', 'APPRO')] },
      // Ancienne adresse, conservee pour les liens et favoris deja poses.
      { path: 'admin/production', redirectTo: 'production', pathMatch: 'full' },
      { path: 'admin/sessions', loadComponent: () => import('./pages/admin/sessions/sessions.component').then(m => m.SessionsComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/blocked-users', loadComponent: () => import('./pages/admin/blocked-users/blocked-users.component').then(m => m.BlockedUsersComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'admin/overtime', loadComponent: () => import('./pages/admin/overtime/overtime.component').then(m => m.AdminOvertimeComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },

      // Support pages
      { path: 'support/dashboard', loadComponent: () => import('./pages/support/dashboard/dashboard.component').then(m => m.SupportDashboardComponent), canActivate: [roleGuard('SUPPORT_TECHNIQUE', 'ADMINISTRATEUR')] },
      { path: 'support/tickets', loadComponent: () => import('./modules/ticket/pages/ticket-list/ticket-list.component').then(m => m.TicketListComponent), canActivate: [roleGuard('SUPPORT_TECHNIQUE')] },
      { path: 'support/tickets/:id', loadComponent: () => import('./modules/ticket/pages/ticket-chat/ticket-chat.component').then(m => m.TicketChatComponent) },
      // Les conversations de projet, cote equipe. Le chef de projet a le droit
      // d'y ecrire depuis toujours ; il n'avait simplement aucun chemin pour
      // les atteindre.
      { path: 'support/discussions', loadComponent: () => import('./modules/ticket/pages/discussions-list/discussions-list.component').then(m => m.DiscussionsListComponent), canActivate: [roleGuard('SUPPORT_TECHNIQUE', 'CHEF_DE_PROJET')] },
      { path: 'support/discussions/:projetId', loadComponent: () => import('./modules/ticket/pages/project-chat/project-chat.component').then(m => m.ProjectChatComponent) },

      // Assistant IA
      { path: 'assistant', loadComponent: () => import('./modules/assistant/pages/assistant-page/assistant-page.component').then(m => m.AssistantPageComponent) },
      { path: 'admin/assistant-knowledge', loadComponent: () => import('./modules/assistant/pages/admin-knowledge/admin-knowledge.component').then(m => m.AdminKnowledgeComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },

      // Profile pages
      { path: 'profile', redirectTo: 'profile/edit', pathMatch: 'full' },
      { path: 'profile/edit', loadComponent: () => import('./pages/profile/edit-profile/edit-profile.component').then(m => m.EditProfileComponent) },
      { path: 'profile/change-password', loadComponent: () => import('./pages/profile/change-password/change-password.component').then(m => m.ChangePasswordComponent) },
      { path: 'profile/security', loadComponent: () => import('./pages/profile/security/security.component').then(m => m.SecurityComponent) },

      // Validator / CDP Billing routes
      { path: 'validator/dashboard', loadComponent: () => import('./pages/validator/dashboard/dashboard.component').then(m => m.CdpDashboardComponent), canActivate: [roleGuard('CHEF_DE_PROJET', 'ADMINISTRATEUR')] },
      { path: 'validator/quotes', loadComponent: () => import('./modules/billing/pages/cdp-quote-list/cdp-quote-list.component').then(m => m.CdpQuoteListComponent), canActivate: [roleGuard('CHEF_DE_PROJET', 'ADMINISTRATEUR')] },
      { path: 'validator/quotes/new/:projectId', loadComponent: () => import('./modules/billing/pages/cdp-create-quote/cdp-create-quote.component').then(m => m.CdpCreateQuoteComponent), canActivate: [roleGuard('CHEF_DE_PROJET', 'ADMINISTRATEUR')] },
      { path: 'validator/invoices', loadComponent: () => import('./modules/billing/pages/cdp-invoice-list/cdp-invoice-list.component').then(m => m.CdpInvoiceListComponent), canActivate: [roleGuard('CHEF_DE_PROJET', 'ADMINISTRATEUR')] },

      // Feedback qualité — réservé à l'administrateur : la page classe les agents support
      // et les chefs de projet entre eux, ces classements ne leur sont pas destinés.
      { path: 'admin/feedback', loadComponent: () => import('./modules/projet/pages/feedback-dashboard/feedback-dashboard.component').then(m => m.FeedbackDashboardComponent), canActivate: [roleGuard('ADMINISTRATEUR')] },
      { path: 'validator/feedback', redirectTo: 'admin/feedback', pathMatch: 'full' },

      { path: 'validator/queue', redirectTo: 'validator/calendar', pathMatch: 'full' },
      { path: 'validator/calendar', loadComponent: () => import('./pages/validator/cdp-calendar/cdp-calendar.component').then(m => m.CdpCalendarComponent), canActivate: [roleGuard('CHEF_DE_PROJET', 'ADMINISTRATEUR')] },
      { path: 'validator/meetings', redirectTo: 'validator/calendar', pathMatch: 'full' },

      // Appro pages
      { path: 'appro/dashboard', loadComponent: () => import('./pages/appro/dashboard/dashboard.component').then(m => m.ApproDashboardComponent), canActivate: [roleGuard('APPRO')] },

      // Devis, panier, factures : reserves a qui achete. L'ingenieur est un
      // collaborateur invite, pas un acheteur — et masquer l'entree du menu
      // ne suffirait pas, l'URL reste tapable.

      // Stock management pages (ms-stock)
      { path: 'stock', loadComponent: () => import('./modules/stock/pages/dashboard/dashboard.component').then(m => m.StockDashboardComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/components', loadComponent: () => import('./modules/stock/pages/component-list/component-list.component').then(m => m.ComponentListComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/components/:id', loadComponent: () => import('./modules/stock/pages/component-detail/component-detail.component').then(m => m.ComponentDetailComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/suppliers', loadComponent: () => import('./modules/stock/pages/supplier-list/supplier-list.component').then(m => m.SupplierListComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/suppliers/:id', loadComponent: () => import('./modules/stock/pages/supplier-detail/supplier-detail.component').then(m => m.SupplierDetailComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/lots', loadComponent: () => import('./modules/stock/pages/lot-list/lot-list.component').then(m => m.LotListComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/locations', loadComponent: () => import('./modules/stock/pages/location-list/location-list.component').then(m => m.LocationListComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      { path: 'stock/locations/:id', loadComponent: () => import('./modules/stock/pages/location-detail/location-detail.component').then(m => m.LocationDetailComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO')] },
      // Le technicien lit les bobines : il doit voir où elles sont avant
      // d'aller les chercher. Il n'y crée ni ne supprime rien — ses gestes
      // (sortie, retour, décompte) vivent dans l'écran de production.
      { path: 'stock/reels', loadComponent: () => import('./modules/stock/pages/reel-list/reel-list.component').then(m => m.ReelListComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO', 'TECHNICIEN')] },
      { path: 'stock/reels/:id', loadComponent: () => import('./modules/stock/pages/reel-detail/reel-detail.component').then(m => m.ReelDetailComponent), canActivate: [roleGuard('ADMINISTRATEUR', 'APPRO', 'TECHNICIEN')] },

      // Aliases de redirection pour notifications & liens directs
      { path: 'tickets/:id', redirectTo: 'support/tickets/:id', pathMatch: 'full' },
      { path: 'admin/projets/:id', redirectTo: 'client/projets/:id', pathMatch: 'full' },
      { path: 'projet/detail/:id', redirectTo: 'client/projets/:id', pathMatch: 'full' },
      { path: 'projet/:id/gerber-viewer', redirectTo: 'client/projets/:id/gerber-viewer', pathMatch: 'full' },
      { path: 'projets/:id/gerber-viewer', redirectTo: 'client/projets/:id/gerber-viewer', pathMatch: 'full' },
      { path: 'client/quotes/:id', redirectTo: 'client/billing/quotes', pathMatch: 'full' },
    ]
  },

  // Écrans de fin de règlement
  { path: 'payment/success', loadComponent: () => import('./modules/billing/pages/payment-success/payment-success.component').then(m => m.PaymentSuccessComponent) },
  { path: 'payment/fail', loadComponent: () => import('./modules/billing/pages/payment-fail/payment-fail.component').then(m => m.PaymentFailComponent) },

  // Wildcard fallback
  { path: '**', loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent) },
];
