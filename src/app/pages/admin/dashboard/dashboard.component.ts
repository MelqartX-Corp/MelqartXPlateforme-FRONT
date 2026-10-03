import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin, of, Observable, OperatorFunction } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ProfileService, AdminStatsService } from '../../../services';
import { AdminStats } from '../../../modules/user/models/admin.models';
import { BillingService } from '../../../modules/billing/services/billing.service';
import { BillingAnalytics, BillingDashboard } from '../../../modules/billing/models/billing.models';
import { ProjetService } from '../../../modules/projet/services/projet.service';
import { ProjetStats } from '../../../modules/projet/models/projet.models';
import { TicketService } from '../../../modules/ticket';
import { TicketAnalytics } from '../../../modules/ticket/models/ticket.models';

import {
  ChartAreaComponent, ChartBarsComponent, ChartDonutComponent,
  ChartRankingComponent, ChartGaugeComponent, ChartSparklineComponent,
  ChartSeries, ChartSlice, STATUS_COLORS, formatFull, formatCompact,
} from '../../../shared/charts';
import { DashIconComponent, StatTileComponent, StatTile } from '../../../shared/ui';
import {
  LIBELLES_ROLE, LIBELLES_STATUT_DEVIS, LIBELLES_ETAPE_COMMANDE,
  LIBELLES_STATUT_FACTURE, LIBELLES_PRIORITE_TICKET, LIBELLES_TRANCHE_AGE,
  LIBELLES_STATUT_TICKET, LIBELLES_OBJECTIF, LIBELLES_MOYEN_PAIEMENT,
  traduire, dureeCourte, dureeDepuisMinutes, ilYA,
} from '../../../shared/dashboard-labels';

export interface DashboardAlerte {
  type: 'warning' | 'danger' | 'info' | 'success';
  titre: string;
  description: string;
  actionLabel?: string;
  actionRoute?: string;
  icone: string;
}

/**
 * Le tableau de bord de l'administration.
 *
 * Il agrège quatre domaines — comptes, facturation, projets, support — que
 * quatre microservices détiennent séparément. Chacun est interrogé en
 * parallèle et, surtout, isolé : si la facturation ne répond pas, ses cartes
 * le disent sur place, mais les projets et le support restent lisibles. Un
 * `forkJoin` sans garde ferait l'inverse — une seule panne viderait la page.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    ChartAreaComponent, ChartBarsComponent, ChartDonutComponent,
    ChartRankingComponent, ChartGaugeComponent, ChartSparklineComponent,
    DashIconComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private profileService = inject(ProfileService);
  private adminStatsService = inject(AdminStatsService);
  private billingService = inject(BillingService);
  private projetService = inject(ProjetService);
  private ticketService = inject(TicketService);
  private router = inject(Router);

  readonly userName = signal('');
  readonly chargement = signal(true);
  readonly derniereMaj = signal<Date | null>(null);

  readonly comptes = signal<AdminStats | null>(null);
  readonly facturation = signal<BillingAnalytics | null>(null);
  readonly finances = signal<BillingDashboard | null>(null);
  readonly projets = signal<ProjetStats | null>(null);
  readonly support = signal<TicketAnalytics | null>(null);

  /** Les domaines tombés en erreur — chaque carte concernée le dit sur place. */
  readonly enErreur = signal<Set<string>>(new Set());

  readonly filtrePeriode = signal<'3M' | '6M' | '12M'>('12M');

  readonly dateDuJour = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  });

  protected readonly formatFull = formatFull;
  protected readonly formatCompact = formatCompact;
  protected readonly dureeCourte = dureeCourte;
  protected readonly dureeDepuisMinutes = dureeDepuisMinutes;

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (u) => this.userName.set(u.prenom || u.nom || ''),
      error: () => this.userName.set(''),
    });
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    const echecs = new Set<string>();

    const garde = <T>(cle: string) => this.garde<T>(cle, echecs);

    forkJoin({
      comptes: this.adminStatsService.getStats().pipe(garde<AdminStats>('comptes')),
      facturation: this.billingService.getAnalytics().pipe(garde<BillingAnalytics>('facturation')),
      finances: this.billingService.getGlobalDashboard().pipe(garde<BillingDashboard>('facturation')),
      projets: this.projetService.getProjetStats().pipe(garde<ProjetStats>('projets')),
      support: this.ticketService.getAnalytics().pipe(garde<TicketAnalytics>('support')),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe((r) => {
        this.comptes.set(r.comptes);
        this.facturation.set(r.facturation);
        this.finances.set(r.finances);
        this.projets.set(r.projets);
        this.support.set(r.support);
        this.enErreur.set(echecs);
        this.derniereMaj.set(new Date());
      });
  }

  /**
   * Neutralise l'échec d'un domaine au lieu de le propager.
   *
   * `forkJoin` abandonne dès la première erreur : sans cette garde, une
   * facturation en panne effacerait aussi les comptes, les projets et le
   * support, tous récupérés correctement.
   */
  private garde<T>(cle: string, echecs: Set<string>): OperatorFunction<T, T | null> {
    return catchError((): Observable<T | null> => {
      echecs.add(cle);
      return of(null);
    });
  }

  echoue(domaine: string): boolean {
    return this.enErreur().has(domaine);
  }

  // ═══════════════════════════════ Tuiles ═══════════════════════════════

  readonly tuiles = computed<StatTile[]>(() => {
    const c = this.comptes();
    const f = this.facturation();
    const fin = this.finances();
    const p = this.projets();
    const s = this.support();
    const out: StatTile[] = [];

    if (c) {
      out.push({
        label: 'Utilisateurs', value: formatFull(c.totalUsers), icon: 'users', ton: 'primary',
        sub: `${c.newUsersThisMonth} ce mois · ${c.externalUsers} externes`,
        change: pourcent(c.userGrowthPercent), up: c.userGrowthPercent >= 0,
        spark: c.signupsByMonth.map((m) => m.count),
        lien: '/admin/users',
      });
      out.push({
        label: 'Organisations', value: formatFull(c.totalOrganisations), icon: 'building', ton: 'accent',
        sub: `${c.organisationsWithUsers} avec des comptes rattachés`,
        lien: '/admin/organisations',
      });
      // Un compte cree et jamais active n'est ni un utilisateur ni une erreur :
      // c'est une invitation restee sans reponse, et personne ne la relancera
      // tant qu'elle ne se compte pas quelque part.
      out.push({
        label: 'Comptes en attente', value: formatFull(c.pendingSetup), icon: 'hourglass',
        ton: c.pendingSetup > 0 ? 'warning' : 'success',
        sub: `${c.unverifiedUsers} e-mail(s) non vérifié(s)`,
        lien: '/admin/users',
      });
      // Actifs contre inactifs : le total seul grossit sans jamais dire
      // combien de ces comptes servent encore.
      out.push({
        label: 'Comptes actifs', value: formatFull(c.activeUsers), icon: 'check', ton: 'success',
        sub: `${c.inactiveUsers} inactif(s) · ${c.verifiedUsers} vérifié(s)`,
        lien: '/admin/users',
      });
    }

    if (p) {
      out.push({
        label: 'Projets', value: formatFull(p.total), icon: 'kanban', ton: 'primary',
        sub: `${p.enCours} en cours · ${p.nonAssignes} non assignés`,
        change: variation(p.nouveauxCeMois, p.nouveauxMoisPrecedent),
        up: p.nouveauxCeMois >= p.nouveauxMoisPrecedent,
        spark: p.evolution.map((e) => e.crees),
        lien: '/client/projets',
      });
    }

    if (f) {
      out.push({
        label: 'Devis émis', value: formatFull(f.totalQuotes), icon: 'file-text', ton: 'accent',
        sub: `${f.quotesThisMonth} ce mois · ${f.acceptedQuotes} acceptés`,
        change: variation(f.quotesThisMonth, f.quotesLastMonth),
        up: f.quotesThisMonth >= f.quotesLastMonth,
        spark: f.quotesByMonth.map((m) => m.count),
        lien: '/validator/quotes',
      });
      out.push({
        label: 'Commandes', value: formatFull(f.totalOrders), icon: 'package', ton: 'primary',
        sub: `${f.ordersInProduction} en atelier · ${f.ordersDelivered} livrées`,
        change: variation(f.ordersThisMonth, f.ordersLastMonth),
        up: f.ordersThisMonth >= f.ordersLastMonth,
        spark: f.ordersByDay.map((d) => d.count),
        lien: '/production',
      });
      out.push({
        label: 'Taux de conversion', value: `${f.conversionRate}%`, icon: 'trending', ton: 'success',
        sub: 'devis acceptés / soumis',
        spark: f.quotesByMonth.map((m) => (m.count > 0 ? (m.accepted / m.count) * 100 : 0)),
      });
      out.push({
        label: 'Panier moyen', value: formatCompact(f.avgOrderValue), icon: 'dollar', ton: 'accent',
        sub: `${formatCompact(f.avgQuoteValue)} par devis`,
      });
      // Le delai reel de bout en bout — reglement, atelier, transporteur. Le
      // serveur le calculait deja ; aucun ecran ne l'affichait, et c'est
      // pourtant le seul chiffre qui dit si l'atelier tient ses promesses.
      out.push({
        label: 'Délai de livraison', icon: 'truck', ton: 'primary',
        value: f.avgDeliveryDays != null ? `${f.avgDeliveryDays.toFixed(1)} j` : '—',
        sub: `${f.ordersShipped} expédiée(s) · ${f.ordersDelivered} livrée(s)`,
        lien: '/production',
      });
      out.push({
        label: 'Délai de paiement', icon: 'hourglass', ton: 'warning',
        value: f.avgPaymentDays != null ? `${f.avgPaymentDays.toFixed(1)} j` : '—',
        sub: `${f.paidInvoices}/${f.totalInvoices} factures réglées`,
        lien: '/validator/invoices',
      });
    }

    if (fin) {
      out.push({
        label: 'Encaissé', value: formatCompact(fin.totalCollected), icon: 'dollar', ton: 'success',
        sub: `${formatCompact(fin.totalInvoiced)} TND facturés`,
        spark: f?.revenueByMonth.map((m) => m.collected),
        lien: '/admin/billing',
      });
      out.push({
        label: 'Reste à encaisser', value: formatCompact(fin.totalOutstanding), icon: 'hourglass',
        // Un impayé n'est pas une bonne nouvelle : le ton suit l'enjeu, pas
        // la place de la tuile dans la grille.
        ton: fin.totalOutstanding > 0 ? 'warning' : 'success',
        sub: `${fin.pendingInvoicesCount} facture(s) en attente`,
        lien: '/admin/billing/payments',
      });
    }

    if (f && f.overdueInvoices > 0) {
      out.push({
        label: 'Factures en retard', value: formatFull(f.overdueInvoices), icon: 'alert-triangle',
        ton: 'destructive', sub: `${formatCompact(f.overdueAmount)} TND échus`,
        lien: '/admin/billing/payments',
      });
    }

    if (s) {
      out.push({
        label: 'Tickets ouverts', value: formatFull(s.backlog), icon: 'headphones',
        ton: s.critiques > 0 ? 'destructive' : 'primary',
        sub: `${s.critiques} critique(s) · ${s.sansReponse} sans réponse`,
        spark: s.evolution.map((d) => d.created),
        lien: '/support/tickets',
      });
    }

    if (p?.delaiMoyenLivraisonJours != null) {
      out.push({
        label: 'Délai projet moyen', value: `${p.delaiMoyenLivraisonJours} j`, icon: 'clock', ton: 'warning',
        sub: 'de la création à la livraison',
      });
    }

    if (c) {
      out.push({
        label: 'Sessions actives', value: formatFull(c.activeSessions), icon: 'wifi', ton: 'accent',
        sub: `${c.onlineUsers} personne(s) · ${c.activeLast15Min} actives < 15 min`,
        spark: c.loginsByDay.map((d) => d.count),
        lien: '/admin/sessions',
      });
    }

    if (p?.noteMoyenne != null) {
      out.push({
        label: 'Satisfaction', value: `${p.noteMoyenne}/5`, icon: 'star',
        ton: p.noteMoyenne >= 4 ? 'success' : p.noteMoyenne >= 3 ? 'warning' : 'destructive',
        sub: `${p.avisRecus} avis reçus`,
        lien: '/admin/feedback',
      });
    }

    return out;
  });

  readonly scoreSanteGlobal = computed<number>(() => {
    const f = this.facturation();
    const fin = this.finances();
    const s = this.support();
    let totalPoids = 0;
    let score = 0;
    if (f?.conversionRate != null) {
      score += f.conversionRate * 0.3;
      totalPoids += 0.3;
    }
    if (fin?.collectionRate != null) {
      score += fin.collectionRate * 0.3;
      totalPoids += 0.3;
    }
    if (s?.slaCompliance != null) {
      score += s.slaCompliance * 0.25;
      totalPoids += 0.25;
    }
    if (s) {
      const resRate = s.backlog === 0 ? 100 : s.resolutionRate;
      score += resRate * 0.15;
      totalPoids += 0.15;
    }
    return totalPoids > 0 ? Math.round(score / totalPoids) : 82;
  });

  readonly alertes = computed<DashboardAlerte[]>(() => {
    const p = this.projets();
    const f = this.facturation();
    const fin = this.finances();
    const s = this.support();
    const list: DashboardAlerte[] = [];

    if (p && p.nonAssignes > 0) {
      list.push({
        type: 'warning',
        titre: `${p.nonAssignes} projets non assignés`,
        description: "En attente d'affectation à un Chef de Projet",
        actionLabel: 'Affecter',
        actionRoute: '/client/projets',
        icone: 'kanban',
      });
    }

    if (fin && fin.totalOutstanding > 0) {
      list.push({
        type: 'warning',
        titre: `${formatCompact(fin.totalOutstanding)} TND à encaisser`,
        description: `${fin.pendingInvoicesCount} facture(s) en attente de règlement`,
        actionLabel: 'Trésorerie',
        actionRoute: '/admin/billing/payments',
        icone: 'dollar',
      });
    }

    if (f && f.overdueInvoices > 0) {
      list.push({
        type: 'danger',
        titre: `${f.overdueInvoices} facture(s) en retard`,
        description: `${formatCompact(f.overdueAmount)} TND échus nécessitant relance`,
        actionLabel: 'Relancer',
        actionRoute: '/admin/billing/payments',
        icone: 'alert-triangle',
      });
    }

    if (p && p.noteMoyenne != null && p.noteMoyenne < 3.5) {
      list.push({
        type: 'info',
        titre: `Satisfaction client : ${p.noteMoyenne}/5`,
        description: `Basé sur ${p.avisRecus} avis clients recueillis`,
        actionLabel: 'Consulter',
        actionRoute: '/admin/feedback',
        icone: 'star',
      });
    }

    if (s && s.critiques === 0 && s.sansReponse === 0) {
      list.push({
        type: 'success',
        titre: 'Support opérationnel & conforme',
        description: '0 ticket critique · 100% de conformité SLA de réponse',
        actionLabel: 'Tickets',
        actionRoute: '/support/tickets',
        icone: 'check',
      });
    }

    return list;
  });

  readonly entonnoir = computed(() => {
    const p = this.projets();
    const f = this.facturation();
    const fin = this.finances();
    const totalP = p?.total ?? 0;
    const totalQ = f?.totalQuotes ?? 0;
    const accQ = f?.acceptedQuotes ?? 0;
    const totalO = f?.totalOrders ?? 0;
    const col = fin?.totalCollected ?? 0;

    return [
      {
        cle: 'projets',
        titre: 'Projets créés',
        valeur: `${totalP}`,
        pourcent: '100%',
        description: `${p?.enCours ?? 0} en cours`,
        icone: 'kanban',
        couleur: 'var(--series-1)'
      },
      {
        cle: 'devis',
        titre: 'Devis émis',
        valeur: `${totalQ}`,
        pourcent: totalP > 0 ? `${Math.round((totalQ / totalP) * 100)}%` : '—',
        description: `${f?.quotesThisMonth ?? 0} ce mois`,
        icone: 'file-text',
        couleur: 'hsl(var(--accent))'
      },
      {
        cle: 'acceptes',
        titre: 'Devis acceptés',
        valeur: `${accQ}`,
        pourcent: `${f?.conversionRate ?? 0}%`,
        description: 'Taux conversion',
        icone: 'check',
        couleur: 'hsl(var(--success))'
      },
      {
        cle: 'commandes',
        titre: 'Commandes',
        valeur: `${totalO}`,
        pourcent: accQ > 0 ? `${Math.round((totalO / accQ) * 100)}%` : '0%',
        description: `${f?.ordersInProduction ?? 0} en atelier`,
        icone: 'package',
        couleur: 'hsl(var(--primary))'
      },
      {
        cle: 'encaissement',
        titre: 'CA Encaissé',
        valeur: `${formatCompact(col)} TND`,
        pourcent: `${fin?.collectionRate ?? 0}%`,
        description: `${formatCompact(fin?.totalInvoiced ?? 0)} TND facturés`,
        icone: 'dollar',
        couleur: 'hsl(var(--success))'
      },
    ];
  });

  // ═══════════════════════════════ Séries ═══════════════════════════════

  /**
   * Facturé et encaissé sur le même axe.
   */
  readonly serieRevenu = computed<ChartSeries[]>(() => {
    const f = this.facturation();
    if (!f) return [];
    return [
      { name: 'Facturé', values: f.revenueByMonth.map((m) => m.invoiced), area: true },
      { name: 'Encaissé', values: f.revenueByMonth.map((m) => m.collected), color: STATUS_COLORS.success },
    ];
  });
  readonly moisRevenu = computed(() => this.facturation()?.revenueByMonth.map((m) => m.label) ?? []);

  readonly serieRevenuFiltree = computed<ChartSeries[]>(() => {
    const f = this.facturation();
    if (!f) return [];
    const n = this.filtrePeriode() === '3M' ? 3 : this.filtrePeriode() === '6M' ? 6 : 12;
    const slice = f.revenueByMonth.slice(-n);
    return [
      { name: 'Facturé', values: slice.map((m) => m.invoiced), area: true },
      { name: 'Encaissé', values: slice.map((m) => m.collected), color: STATUS_COLORS.success },
    ];
  });
  readonly moisRevenuFiltres = computed(() => {
    const f = this.facturation();
    if (!f) return [];
    const n = this.filtrePeriode() === '3M' ? 3 : this.filtrePeriode() === '6M' ? 6 : 12;
    return f.revenueByMonth.slice(-n).map((m) => m.label);
  });

  readonly sparkRevenu = computed(() => this.facturation()?.revenueByMonth.map((m) => m.collected) ?? []);
  readonly sparkProjets = computed(() => this.projets()?.evolution.map((e) => e.crees) ?? []);
  readonly sparkDevis = computed(() => this.facturation()?.quotesByMonth.map((m) => m.count) ?? []);
  readonly sparkCommandes = computed(() => this.facturation()?.ordersByDay.map((d) => d.count) ?? []);

  readonly serieDevis = computed<ChartSeries[]>(() => {
    const f = this.facturation();
    if (!f) return [];
    return [
      { name: 'Émis', values: f.quotesByMonth.map((m) => m.count) },
      { name: 'Acceptés', values: f.quotesByMonth.map((m) => m.accepted), color: STATUS_COLORS.success },
    ];
  });
  readonly moisDevis = computed(() => this.facturation()?.quotesByMonth.map((m) => m.label) ?? []);

  readonly serieProjets = computed<ChartSeries[]>(() => {
    const p = this.projets();
    if (!p) return [];
    return [
      { name: 'Créés', values: p.evolution.map((e) => e.crees), area: true },
      { name: 'Livrés', values: p.evolution.map((e) => e.livres), color: STATUS_COLORS.success },
    ];
  });
  readonly moisProjets = computed(() => this.projets()?.evolution.map((e) => e.label) ?? []);

  readonly serieInscriptions = computed<ChartSeries[]>(() => {
    const c = this.comptes();
    if (!c) return [];
    return [{ name: 'Inscriptions', values: c.signupsByMonth.map((m) => m.count), area: true }];
  });
  readonly moisInscriptions = computed(() => this.comptes()?.signupsByMonth.map((m) => m.label) ?? []);

  readonly serieCommandesJour = computed<ChartSeries[]>(() => {
    const f = this.facturation();
    if (!f) return [];
    return [{ name: 'Commandes', values: f.ordersByDay.map((d) => d.count) }];
  });
  readonly joursCommandes = computed(() => this.facturation()?.ordersByDay.map((d) => d.label) ?? []);

  readonly serieTickets = computed<ChartSeries[]>(() => {
    const s = this.support();
    if (!s) return [];
    return [
      { name: 'Créés', values: s.evolution.map((d) => d.created), area: true },
      { name: 'Résolus', values: s.evolution.map((d) => d.resolved), color: STATUS_COLORS.success },
    ];
  });
  readonly joursTickets = computed(() => this.support()?.evolution.map((d) => d.label) ?? []);

  // ════════════════════════════ Répartitions ════════════════════════════

  readonly partsAtelier = computed<ChartSlice[]>(() =>
    (this.facturation()?.ordersByStage ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({ name: traduire(LIBELLES_ETAPE_COMMANDE, k.key), value: k.count })));

  readonly partsStatutDevis = computed<ChartSlice[]>(() =>
    (this.facturation()?.quotesByStatus ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({
        name: traduire(LIBELLES_STATUT_DEVIS, k.key),
        value: k.count,
        hint: `${formatCompact(k.amount)} TND`,
      })));

  readonly partsFactures = computed<ChartSlice[]>(() =>
    (this.facturation()?.invoicesByStatus ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({
        name: traduire(LIBELLES_STATUT_FACTURE, k.key),
        value: k.count,
        hint: `${formatCompact(k.amount)} TND`,
      })));

  readonly partsRoles = computed<ChartSlice[]>(() =>
    (this.comptes()?.byRole ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({ name: traduire(LIBELLES_ROLE, k.key), value: k.count })));

  readonly partsAppareils = computed<ChartSlice[]>(() =>
    (this.comptes()?.sessionsByDeviceType ?? [])
      .map((k) => ({ name: appareil(k.key), value: k.count })));

  readonly partsNavigateurs = computed<ChartSlice[]>(() =>
    (this.comptes()?.sessionsByBrowser ?? []).map((k) => ({ name: k.key, value: k.count })));

  /** Systemes des sessions ouvertes — le pendant naturel des navigateurs. */
  readonly partsSystemes = computed<ChartSlice[]>(() =>
    (this.comptes()?.sessionsByOs ?? []).map((k) => ({ name: k.key, value: k.count })));

  /**
   * Comment les comptes se connectent — mot de passe ou fournisseur externe.
   *
   * Ce n'est pas une curiosite : le jour ou l'authentification Google tombe,
   * ce chiffre dit combien de personnes restent dehors.
   */
  readonly partsConnexion = computed<ChartSlice[]>(() =>
    (this.comptes()?.byAuthProvider ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({ name: k.key === 'LOCAL' ? 'Mot de passe' : k.key, value: k.count })));

  readonly partsObjectifs = computed<ChartSlice[]>(() =>
    (this.projets()?.parObjectif ?? [])
      .filter((r) => r.nombre > 0)
      .map((r) => ({ name: traduire(LIBELLES_OBJECTIF, r.cle), value: r.nombre })));

  readonly partsIndustries = computed<ChartSlice[]>(() =>
    (this.projets()?.parIndustrie ?? []).map((r) => ({ name: industrie(r.cle), value: r.nombre })));

  readonly partsPaiement = computed<ChartSlice[]>(() =>
    (this.facturation()?.paymentsByMethod ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({
        name: traduire(LIBELLES_MOYEN_PAIEMENT, k.key),
        value: k.count,
        hint: `${formatCompact(k.amount)} TND encaissés`,
      })));

  /**
   * Priorités des tickets : l'ordre est celui de l'urgence, et la couleur est
   * un état, pas une identité — d'où les jetons de statut plutôt que les
   * teintes de série.
   */
  readonly partsPriorite = computed<ChartSlice[]>(() => {
    const ordre = ['URGENTE', 'HAUTE', 'MOYENNE', 'BASSE'];
    const tons: Record<string, string> = {
      URGENTE: STATUS_COLORS.danger,
      HAUTE: STATUS_COLORS.warning,
      MOYENNE: 'var(--series-1)',
      BASSE: STATUS_COLORS.neutral,
    };
    const par = this.support()?.parPriorite ?? [];
    return ordre
      .map((cle) => par.find((k) => k.key === cle))
      .filter((k): k is NonNullable<typeof k> => !!k)
      .map((k) => ({
        name: traduire(LIBELLES_PRIORITE_TICKET, k.key),
        value: k.count,
        color: tons[k.key],
      }));
  });

  readonly partsAgeTickets = computed<ChartSlice[]>(() => {
    const tons = [STATUS_COLORS.success, 'var(--series-1)', STATUS_COLORS.warning, STATUS_COLORS.danger];
    return (this.support()?.ageBuckets ?? []).map((k, i) => ({
      name: traduire(LIBELLES_TRANCHE_AGE, k.key),
      value: k.count,
      color: tons[i],
    }));
  });

  readonly partsStatutTickets = computed<ChartSlice[]>(() =>
    (this.support()?.parStatut ?? [])
      .filter((k) => k.count > 0)
      .map((k) => ({ name: traduire(LIBELLES_STATUT_TICKET, k.key), value: k.count })));

  readonly charge = computed(() => this.projets()?.charge?.slice(0, 8) ?? []);
  readonly meilleursClients = computed(() => this.facturation()?.topCustomers ?? []);
  readonly meilleursAgents = computed(() => this.support()?.topResolvers ?? []);

  /** Le plus gros chiffre d'affaires du classement, pour la barre de progression. */
  readonly maxClient = computed(() =>
    Math.max(...this.meilleursClients().map((c) => c.revenue), 1));

  readonly majAffichee = computed(() => {
    const d = this.derniereMaj();
    return d ? ilYA(d) : '';
  });

  // ══════════════════════════════ Actions ══════════════════════════════

  allerA(lien?: string): void {
    if (lien) this.router.navigate([lien]);
  }

  /**
   * Export CSV des indicateurs affichés.
   *
   * Point-virgule et BOM UTF-8 : sans eux, Excel en configuration française
   * met toute la ligne dans une seule colonne et casse les accents.
   */
  exporter(): void {
    const lignes: string[][] = [['Indicateur', 'Valeur', 'Détail']];
    for (const t of this.tuiles()) {
      lignes.push([t.label, t.value, t.sub ?? '']);
    }

    const f = this.facturation();
    if (f) {
      lignes.push([]);
      lignes.push(['Mois', 'Facturé (TND)', 'Encaissé (TND)', 'Devis émis', 'Devis acceptés']);
      f.revenueByMonth.forEach((m, i) => {
        const d = f.quotesByMonth[i];
        lignes.push([m.label, String(m.invoiced), String(m.collected),
          String(d?.count ?? 0), String(d?.accepted ?? 0)]);
      });
    }

    const csv = lignes
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tableau-de-bord-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ══════════════════════════════ Formatage ══════════════════════════════

function pourcent(v: number): string {
  return `${v >= 0 ? '+' : ''}${v}%`;
}

/**
 * Variation d'un mois sur l'autre, en écart absolu.
 *
 * Plus honnête qu'un pourcentage sur de petits volumes : passer de 1 à 4
 * projets se lit « +3 », pas « +300 % ».
 */
function variation(courant: number, precedent: number): string {
  const delta = courant - precedent;
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

function appareil(cle: string): string {
  const m: Record<string, string> = { PC: 'Ordinateur', MOBILE: 'Mobile', UNKNOWN: 'Inconnu' };
  return m[cle] ?? cle;
}

function industrie(cle: string): string {
  const m: Record<string, string> = {
    IOT: 'IoT', AUTOMOTIVE: 'Automobile', INDUSTRIAL: 'Industriel',
    SMART_INFRASTRUCTURE: 'Infrastructure', ENERGY: 'Énergie',
    LOGISTICS: 'Logistique', CONSUMER_ELECTRONICS: 'Grand public',
    MEDICAL_SPECIALIZED: 'Médical',
  };
  return m[cle] ?? cle;
}
