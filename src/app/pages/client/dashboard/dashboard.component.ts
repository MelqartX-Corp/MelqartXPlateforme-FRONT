import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProfileService, AuthService } from '../../../services';
import { ProjetService } from '../../../modules/projet/services/projet.service';
import { BillingService } from '../../../modules/billing/services/billing.service';
import { ReunionService } from '../../../modules/projet/services/reunion.service';
import { TicketService } from '../../../modules/ticket/services/ticket.service';
import { Projet } from '../../../modules/projet/models/projet.models';
import { Quote, Invoice } from '../../../modules/billing/models/billing.models';
import { Reunion } from '../../../modules/projet/models/reunion.models';
import { Ticket } from '../../../modules/ticket/models/ticket.models';

export interface PipelineSegment {
  id: string;
  label: string;
  count: number;
  color: string;
  percentage: number;
  strokeDasharray: string;
  strokeDashoffset: string;
}

export interface ActionItem {
  id: string;
  title: string;
  message: string;
  ctaText: string;
  ctaLink: string;
  icon: string;
  badge: string;
  level: 'warning' | 'info' | 'critical' | 'success';
}

export interface ActivityEvent {
  id: string;
  title: string;
  subtitle: string;
  date: Date;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  private profileService = inject(ProfileService);
  private authService = inject(AuthService);
  private projetService = inject(ProjetService);
  private billingService = inject(BillingService);
  private reunionService = inject(ReunionService);
  private ticketService = inject(TicketService);

  private subs = new Subscription();

  loading = true;
  userRole = 'CLIENT';
  userName = '';
  orgName = '';

  get lectureSeule(): boolean {
    return this.authService.lectureSeule || this.userRole === 'INGENIEUR';
  }

  // Raw entities
  projets: Projet[] = [];
  quotes: Quote[] = [];
  invoices: Invoice[] = [];
  reunions: Reunion[] = [];
  tickets: Ticket[] = [];

  // Card 1: Active Projects
  activeProjectsCount = 0;
  inProductionCount = 0;
  inValidationCount = 0;
  sparklinePoints = 'M 0,25 Q 20,20 40,28 T 80,12 T 120,18 T 160,8 T 200,4';
  sparklineArea = 'M 0,25 Q 20,20 40,28 T 80,12 T 120,18 T 160,8 T 200,4 L 200,35 L 0,35 Z';

  // Card 2: Quotes & Scoping (all derived from the Quote entity, not Projet.statut)
  quotesAwaitingCount = 0;
  estimatedQuotesValue = 0;
  quotesDraftCount = 0;
  quotesSentCount = 0;
  quotesAcceptedCount = 0;

  // Card 3: Budget Committed
  totalCommittedBudget = 0;
  totalPaidBudget = 0;
  totalRemainingBudget = 0;
  paidPercentage = 0;

  // Card 4: Support & Meetings
  nextMeeting: Reunion | null = null;
  nextMeetingTimeLabel = 'Aucune session';
  nextMeetingCountdown = '';
  openTicketsCount = 0;

  // Attention Center
  actionItems: ActionItem[] = [];

  // Radial Pipeline Chart
  pipelineSegments: PipelineSegment[] = [];
  hoveredSegment: PipelineSegment | null = null;
  totalProjectsCount = 0;
  pipelineCompletionRate = 0;

  // Active Projects List
  activeProjectsList: Projet[] = [];

  // Recent Activity Feed — real events merged from projects, quotes, invoices & tickets
  recentActivity: ActivityEvent[] = [];

  ngOnInit() {
    this.userRole = this.authService.role || localStorage.getItem('userRole') || 'CLIENT';
    this.loadDashboardData();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  loadDashboardData() {
    this.loading = true;

    const sub = forkJoin({
      profile: this.profileService.getProfile().pipe(catchError(() => of(null))),
      projetsPage: this.projetService.getMesProjets(0, 100).pipe(catchError(() => of({ content: [] as Projet[] }))),
      quotes: this.billingService.getQuotes().pipe(catchError(() => of([] as Quote[]))),
      invoices: this.billingService.getInvoices().pipe(catchError(() => of([] as Invoice[]))),
      reunions: this.reunionService.getMyReunions().pipe(catchError(() => of([] as Reunion[]))),
      ticketsPage: this.ticketService.getMesTickets(0, 50).pipe(catchError(() => of({ content: [] as Ticket[] })))
    }).subscribe({
      next: ({ profile, projetsPage, quotes, invoices, reunions, ticketsPage }) => {
        if (profile) {
          this.userName = profile.prenom || profile.nom || '';
          this.orgName = (profile as any).organisation?.nom || (profile as any).organisationNom || '';
        }

        this.projets = projetsPage?.content || [];
        this.quotes = quotes || [];
        this.invoices = invoices || [];
        this.reunions = reunions || [];
        this.tickets = ticketsPage?.content || [];

        this.computeAllMetrics();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.subs.add(sub);
  }

  private computeAllMetrics() {
    const total = this.projets.length;
    this.totalProjectsCount = total;

    // 1. Projects Breakdown
    let draft = 0;
    let scoping = 0;
    let quoted = 0;
    let inProgress = 0;
    let confirmed = 0;
    let completed = 0;

    for (const p of this.projets) {
      switch (p.statut) {
        case 'BROUILLON': draft++; break;
        case 'PENDING': scoping++; break;
        case 'QUOTED': quoted++; break;
        case 'CONFIRMED': confirmed++; break;
        case 'IN_PROGRESS': inProgress++; break;
        case 'COMPLETED': completed++; break;
      }
    }

    this.activeProjectsCount = inProgress + confirmed + quoted + scoping;
    this.inProductionCount = inProgress + confirmed;
    this.inValidationCount = quoted + scoping;

    // 2. Budget & Quotes Calculation
    let totalInvoiced = 0;
    let totalPaid = 0;

    for (const inv of this.invoices) {
      const amt = Number(inv.totalTtc) || 0;
      totalInvoiced += amt;
      if (inv.status === 'PAID') {
        totalPaid += amt;
      } else if (inv.amountPaid) {
        totalPaid += Number(inv.amountPaid) || 0;
      }
    }

    let quotesVal = 0;
    let quotesPendingCount = 0;
    let quotesDraft = 0;
    let quotesSent = 0;
    let quotesAccepted = 0;
    for (const q of this.quotes) {
      if (q.status === 'SENT' || q.status === 'DRAFT') {
        quotesPendingCount++;
        quotesVal += Number(q.totalTtc) || 0;
      }
      if (q.status === 'DRAFT') quotesDraft++;
      else if (q.status === 'SENT') quotesSent++;
      else if (q.status === 'ACCEPTED') quotesAccepted++;
    }

    this.quotesAwaitingCount = quotesPendingCount;
    this.estimatedQuotesValue = quotesVal;
    this.quotesDraftCount = quotesDraft;
    this.quotesSentCount = quotesSent;
    this.quotesAcceptedCount = quotesAccepted;

    this.totalCommittedBudget = totalInvoiced;
    this.totalPaidBudget = totalPaid;
    this.totalRemainingBudget = Math.max(0, totalInvoiced - totalPaid);
    this.paidPercentage = totalInvoiced > 0 ? Math.min(100, Math.round((totalPaid / totalInvoiced) * 100)) : 0;

    // 3. Meetings & Support
    const now = new Date();
    const futureReunions = this.reunions
      .filter(r => r.statut !== 'ANNULEE' && new Date(r.dateDebut) >= new Date(now.getTime() - 1000 * 60 * 60))
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());

    if (futureReunions.length > 0) {
      this.nextMeeting = futureReunions[0];
      const meetDate = new Date(this.nextMeeting.dateDebut);
      const isToday = meetDate.toDateString() === now.toDateString();
      const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === meetDate.toDateString();
      const timeStr = meetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) this.nextMeetingTimeLabel = `Aujourd'hui · ${timeStr}`;
      else if (isTomorrow) this.nextMeetingTimeLabel = `Demain · ${timeStr}`;
      else this.nextMeetingTimeLabel = `${meetDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${timeStr}`;

      const diffHours = Math.round((meetDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      this.nextMeetingCountdown = diffHours > 0 ? `Dans ${diffHours}h` : 'En cours';
    } else {
      this.nextMeeting = null;
      this.nextMeetingTimeLabel = 'Aucune session';
      this.nextMeetingCountdown = '';
    }

    this.openTicketsCount = this.tickets.filter(t => t.statut === 'OUVERT' || t.statut === 'EN_COURS').length;

    // 4. Attention Center (Action Items)
    this.actionItems = [];

    for (const p of this.projets) {
      if (p.bomRequired && !p.bomUploaded) {
        this.actionItems.push({
          id: p.id,
          title: `BOM manquant : ${p.nom}`,
          message: "Le fichier BOM est requis pour finaliser l'étude de fabrication et la commande des composants.",
          ctaText: 'Téléverser BOM',
          ctaLink: `/client/projets/${p.id}`,
          icon: '📄',
          badge: 'Action requise',
          level: 'warning'
        });
      }
    }

    for (const q of this.quotes) {
      if (q.status === 'SENT') {
        this.actionItems.push({
          id: q.id,
          title: `Devis en attente : ${q.projectName || q.quoteNumber}`,
          message: `Proposition commerciale de ${q.totalTtc} ${q.currency || 'TND'} prête pour votre validation.`,
          ctaText: 'Examiner le devis',
          ctaLink: '/client/billing/quotes',
          icon: '⚡',
          badge: 'Devis Prêt',
          level: 'critical'
        });
      }
    }

    if (this.nextMeeting && this.nextMeeting.lienVisio) {
      this.actionItems.push({
        id: this.nextMeeting.id,
        title: `Visio technique : ${this.nextMeeting.titre || 'Revue de projet'}`,
        message: `Session avec ${this.nextMeeting.chefProjetNom || 'votre Chef de Projet'} (${this.nextMeetingTimeLabel}).`,
        ctaText: 'Rejoindre Google Meet',
        ctaLink: this.nextMeeting.lienVisio,
        icon: '🎥',
        badge: 'Google Meet',
        level: 'info'
      });
    }

    // 5. Radial Segmented Pipeline Chart Data — built strictly from real statut counts
    const rawSegments = [
      { id: 'DRAFT', label: 'Brouillon', count: draft, color: '#f59e0b' },
      { id: 'SCOPING', label: 'Cadrage', count: scoping, color: '#3b82f6' },
      { id: 'QUOTE', label: 'Devis', count: quoted, color: '#06b6d4' },
      { id: 'PROD', label: 'Fabrication', count: inProgress + confirmed, color: '#10b981' },
      { id: 'DELIVERY', label: 'Livré', count: completed, color: '#8b5cf6' }
    ];

    const circumference = 2 * Math.PI * 54; // r=54 -> 339.29
    let currentOffset = 0;

    this.pipelineSegments = rawSegments.map(s => {
      const pct = total > 0 ? (s.count / total) : 0;
      const dashLength = pct > 0 ? Math.max(0.1, pct * circumference - 4) : 0;
      const gapLength = circumference - dashLength;
      const segment: PipelineSegment = {
        id: s.id,
        label: s.label,
        count: s.count,
        color: s.color,
        percentage: Math.round(pct * 100),
        strokeDasharray: `${dashLength} ${gapLength}`,
        strokeDashoffset: `${-currentOffset}`
      };
      currentOffset += (pct * circumference);
      return segment;
    });

    this.pipelineCompletionRate = total > 0
      ? Math.round(((completed * 1.0 + (inProgress + confirmed) * 0.8 + quoted * 0.5 + scoping * 0.25) / total) * 100)
      : 0;

    // 7. Active Projects List
    this.activeProjectsList = this.projets
      .filter(p => p.statut !== 'ARCHIVED' && p.statut !== 'CANCELLED')
      .slice(0, 5);

    // 8. Recent Activity Feed
    this.computeRecentActivity();
  }

  /** Merges real, timestamped events from every domain into a single reverse-chronological feed. */
  private computeRecentActivity() {
    const events: ActivityEvent[] = [];

    for (const p of this.projets) {
      if (p.createdAt) {
        events.push({
          id: `proj-${p.id}`,
          title: `Projet créé : ${p.nom}`,
          subtitle: 'Nouveau projet PCB',
          date: new Date(p.createdAt),
          icon: '📁',
          color: 'hsl(var(--primary))'
        });
      }
    }

    for (const q of this.quotes) {
      if (q.createdAt) {
        events.push({
          id: `quote-${q.id}`,
          title: `Devis ${q.quoteNumber || ''} créé`,
          subtitle: `${(Number(q.totalTtc) || 0).toLocaleString('fr-FR')} ${q.currency || 'TND'}`,
          date: new Date(q.createdAt),
          icon: '📝',
          color: '#06b6d4'
        });
      }
      if (q.acceptedAt) {
        events.push({
          id: `quote-acc-${q.id}`,
          title: `Devis accepté`,
          subtitle: q.projectName || q.quoteNumber,
          date: new Date(q.acceptedAt),
          icon: '✅',
          color: 'hsl(var(--success))'
        });
      }
    }

    for (const inv of this.invoices) {
      if (inv.issuedAt) {
        events.push({
          id: `inv-${inv.id}`,
          title: `Facture ${inv.invoiceNumber} émise`,
          subtitle: `${(Number(inv.totalTtc) || 0).toLocaleString('fr-FR')} ${inv.currency || 'TND'}`,
          date: new Date(inv.issuedAt),
          icon: '🧾',
          color: 'hsl(var(--warning))'
        });
      }
      if (inv.paidAt) {
        events.push({
          id: `inv-paid-${inv.id}`,
          title: `Facture ${inv.invoiceNumber} payée`,
          subtitle: `${(Number(inv.amountPaid) || Number(inv.totalTtc) || 0).toLocaleString('fr-FR')} ${inv.currency || 'TND'}`,
          date: new Date(inv.paidAt),
          icon: '💳',
          color: 'hsl(var(--success))'
        });
      }
    }

    for (const t of this.tickets) {
      if (t.createdAt) {
        events.push({
          id: `ticket-${t.id}`,
          title: `Ticket support : ${t.sujet}`,
          subtitle: 'Assistance technique',
          date: new Date(t.createdAt),
          icon: '💬',
          color: '#8b5cf6'
        });
      }
    }

    this.recentActivity = events
      .filter(e => !isNaN(e.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6);
  }

  /** Real relative-time label (French) for the activity feed — no invented timestamps. */
  getRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'hier';
    if (diffD < 30) return `il y a ${diffD} j`;
    const diffMonth = Math.floor(diffD / 30);
    if (diffMonth < 12) return `il y a ${diffMonth} mois`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ─── Template Helpers ───
  getTimeGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }

  getFirstName(): string {
    return this.userName || 'Client';
  }

  getProjectProgress(p: Projet): number {
    switch (p.statut) {
      case 'BROUILLON': return 20;
      case 'PENDING': return 40;
      case 'QUOTED': return 60;
      case 'CONFIRMED': return 75;
      case 'IN_PROGRESS': return 90;
      case 'COMPLETED': return 100;
      default: return 30;
    }
  }

  getProjectObjectifLabel(p: Projet): string {
    const labels: Record<string, string> = {
      IDEE: 'Idée',
      FAISABILITE: 'Étude de faisabilité',
      PROTOTYPE: 'Prototype',
      VALIDATION: 'Validation',
      PRODUCTION: 'Production'
    };
    return p.cadrage?.objectif ? labels[p.cadrage.objectif] || p.cadrage.objectif : 'Objectif non défini';
  }

  getProjectQuantity(p: Projet): string {
    if (p.cadrage?.quantiteSouhaitee) return `${p.cadrage.quantiteSouhaitee} unités`;
    return 'Quantité à définir';
  }

  getProjectInitials(nom: string): string {
    if (!nom) return 'PCB';
    const parts = nom.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nom.substring(0, 3).toUpperCase();
  }

  getStepIndex(p: Projet): number {
    switch (p.statut) {
      case 'BROUILLON': return 1;
      case 'PENDING': return p.bomUploaded ? 3 : 2;
      case 'QUOTED': return 4;
      case 'CONFIRMED':
      case 'IN_PROGRESS': return 5;
      case 'COMPLETED': return 6;
      default: return 2;
    }
  }

  getProjectStatusLabel(p: Projet): string {
    const map: Record<string, string> = {
      BROUILLON: 'Cadrage initial',
      PENDING: 'Fichiers & Étude',
      QUOTED: 'Devis prêt',
      CONFIRMED: 'Lancé en fab',
      IN_PROGRESS: 'En assemblage',
      COMPLETED: 'Livré',
      ARCHIVED: 'Archivé',
      CANCELLED: 'Annulé'
    };
    return map[p.statut] || p.statut;
  }
  getProjectNextMilestone(p: Projet): string {
    if (p.statut === 'BROUILLON') return 'Dépôt des fichiers Gerber';
    if (p.statut === 'PENDING') {
      if (p.bomRequired && !p.bomUploaded) return 'Téléverser le fichier BOM';
      return 'Chiffrage & Devis en cours';
    }
    if (p.statut === 'QUOTED') return 'Validation du devis proposé';
    if (p.statut === 'CONFIRMED') return 'Approvisionnement composants';
    if (p.statut === 'IN_PROGRESS') return 'Contrôle qualité & tests';
    if (p.statut === 'COMPLETED') return 'Production & livraison validées';
    return 'Suivi industriel';
  }

  getProjectStatusPill(p: Projet): { label: string, bg: string, text: string, dot: string } {
    switch (p.statut) {
      case 'QUOTED':
        return { label: 'Devis Prêt', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' };
      case 'PENDING':
        if (p.bomRequired && !p.bomUploaded) {
          return { label: 'BOM Requis', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
        }
        return { label: 'En Étude', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' };
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return { label: 'En Fabrication', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' };
      case 'COMPLETED':
        return { label: 'Livré', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' };
      default:
        return { label: 'Cadrage', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400' };
    }
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
}
