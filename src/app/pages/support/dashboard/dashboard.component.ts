import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin, of, Observable, OperatorFunction } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ProfileService } from '../../../services';
import { TicketService, Ticket } from '../../../modules/ticket';
import { TicketAnalytics } from '../../../modules/ticket/models/ticket.models';
import { ProjetService } from '../../../modules/projet/services/projet.service';
import { ProjetStats, Projet } from '../../../modules/projet/models/projet.models';

import {
  ChartAreaComponent, ChartDonutComponent, ChartRankingComponent,
  ChartGaugeComponent, ChartHeatstripComponent,
  ChartSeries, ChartSlice, STATUS_COLORS, formatFull,
} from '../../../shared/charts';
import { DashIconComponent, StatTileComponent, StatTile } from '../../../shared/ui';
import {
  LIBELLES_PRIORITE_TICKET, LIBELLES_STATUT_TICKET, LIBELLES_TYPE_TICKET,
  LIBELLES_TRANCHE_AGE, LIBELLES_ETAPE_PROJET,
  traduire, dureeCourte, dureeDepuisMinutes, ilYA,
} from '../../../shared/dashboard-labels';

/**
 * Le poste de pilotage du support.
 *
 * Le rôle atterrissait directement sur la liste des tickets : utile pour en
 * traiter un, aveugle sur la file entière. Cette page répond d'abord à « par
 * quoi je commence » — ce qui n'a jamais reçu de réponse, ce qui a dépassé son
 * délai, ce qui traîne — puis donne la tendance.
 */
@Component({
  selector: 'app-support-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    ChartAreaComponent, ChartDonutComponent, ChartRankingComponent,
    ChartGaugeComponent, ChartHeatstripComponent,
    DashIconComponent, StatTileComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class SupportDashboardComponent implements OnInit {
  private profileService = inject(ProfileService);
  private ticketService = inject(TicketService);
  private projetService = inject(ProjetService);
  private router = inject(Router);

  readonly userName = signal('');
  readonly chargement = signal(true);
  readonly derniereMaj = signal<Date | null>(null);
  readonly enErreur = signal<Set<string>>(new Set());

  readonly analyse = signal<TicketAnalytics | null>(null);
  readonly tickets = signal<Ticket[]>([]);
  readonly projets = signal<ProjetStats | null>(null);
  readonly mesProjets = signal<Projet[]>([]);

  protected readonly formatFull = formatFull;
  protected readonly dureeCourte = dureeCourte;
  protected readonly dureeDepuisMinutes = dureeDepuisMinutes;
  protected readonly traduire = traduire;
  protected readonly LIBELLES_PRIORITE_TICKET = LIBELLES_PRIORITE_TICKET;
  protected readonly LIBELLES_STATUT_TICKET = LIBELLES_STATUT_TICKET;
  protected readonly LIBELLES_ETAPE_PROJET = LIBELLES_ETAPE_PROJET;
  protected readonly ilYA = ilYA;

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
      analyse: this.ticketService.getAnalytics().pipe(garde<TicketAnalytics>('support')),
      // 200 tickets : de quoi composer une file de travail sans rapatrier
      // tout l'historique — les agrégats, eux, viennent déjà du serveur.
      tickets: this.ticketService.getTickets(0, 200).pipe(garde<any>('support')),
      projets: this.projetService.getProjetStats().pipe(garde<ProjetStats>('projets')),
      mesProjets: this.projetService.getMesProjetsAssignes(0, 30).pipe(garde<any>('projets')),
    })
      .pipe(finalize(() => this.chargement.set(false)))
      .subscribe((r) => {
        this.analyse.set(r.analyse);
        this.tickets.set(r.tickets?.content ?? []);
        this.projets.set(r.projets);
        this.mesProjets.set(r.mesProjets?.content ?? []);
        this.enErreur.set(echecs);
        this.derniereMaj.set(new Date());
      });
  }

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
    const a = this.analyse();
    const p = this.projets();
    const out: StatTile[] = [];
    if (!a) return out;

    out.push({
      label: 'File en cours', value: formatFull(a.backlog), icon: 'inbox',
      ton: a.backlog > 0 ? 'primary' : 'success',
      sub: `${a.ouverts} ouverts · ${a.enCours} pris en charge`,
      spark: a.evolution.map((d) => d.created),
      lien: '/support/tickets',
    });
    out.push({
      label: 'Sans réponse', value: formatFull(a.sansReponse), icon: 'message',
      // Un ticket muet est la seule mesure qui appelle une action immédiate :
      // son ton suit l'urgence, pas une palette décorative.
      ton: a.sansReponse > 0 ? 'warning' : 'success',
      sub: 'aucun message envoyé au client',
      lien: '/support/tickets',
    });
    out.push({
      label: 'Délai dépassé', value: formatFull(a.slaBreaches), icon: 'alert-triangle',
      ton: a.slaBreaches > 0 ? 'destructive' : 'success',
      sub: 'à répondre en priorité',
      lien: '/support/tickets',
    });
    out.push({
      label: 'Critiques', value: formatFull(a.critiques), icon: 'zap',
      ton: a.critiques > 0 ? 'destructive' : 'success',
      sub: 'priorité urgente, encore ouverts',
      lien: '/support/tickets',
    });
    out.push({
      label: "Résolus aujourd'hui", value: formatFull(a.resolvedToday), icon: 'check', ton: 'success',
      sub: `${a.createdToday} nouveau(x) reçu(s)`,
      spark: a.evolution.map((d) => d.resolved),
    });
    out.push({
      label: '1ʳᵉ réponse', value: dureeDepuisMinutes(a.avgFirstResponseMinutes), icon: 'clock',
      ton: 'accent', sub: 'délai moyen constaté',
    });
    out.push({
      label: 'Résolution', value: dureeCourte(a.avgResolutionHours), icon: 'hourglass',
      ton: 'accent', sub: 'de l\'ouverture à la clôture',
    });
    out.push({
      label: 'Plus ancien', value: dureeCourte(a.oldestOpenHours), icon: 'alert',
      ton: (a.oldestOpenHours ?? 0) > 168 ? 'destructive' : (a.oldestOpenHours ?? 0) > 72 ? 'warning' : 'success',
      sub: 'ticket encore ouvert',
    });

    if (p) {
      out.push({
        label: 'Mes projets', value: formatFull(p.total), icon: 'kanban', ton: 'primary',
        sub: `${p.enAttenteContact} en attente de contact`,
        lien: '/client/projets',
      });
    }

    return out;
  });

  // ═══════════════════════════ La file de travail ═══════════════════════════

  /**
   * Les tickets à prendre, dans l'ordre où il faut les prendre.
   *
   * Le classement met d'abord ceux qui n'ont jamais eu de réponse : un client
   * qui attend depuis trois jours sans le moindre accusé de réception est un
   * problème plus grave qu'un dossier urgent déjà engagé. Vient ensuite la
   * priorité, puis l'ancienneté.
   */
  readonly fileDeTravail = computed(() => {
    const rangPriorite: Record<string, number> = { URGENTE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };

    return this.tickets()
      .filter((t) => t.statut === 'OUVERT' || t.statut === 'EN_COURS')
      .sort((a, b) => {
        const muetA = a.firstResponseAt ? 1 : 0;
        const muetB = b.firstResponseAt ? 1 : 0;
        if (muetA !== muetB) return muetA - muetB;

        const pa = rangPriorite[a.priorite] ?? 9;
        const pb = rangPriorite[b.priorite] ?? 9;
        if (pa !== pb) return pa - pb;

        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      })
      .slice(0, 8);
  });

  readonly recemmentResolus = computed(() =>
    this.tickets()
      .filter((t) => t.resolvedAt)
      .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime())
      .slice(0, 5));

  /** Les projets qui attendent un premier contact — l'autre file du support. */
  readonly projetsAContacter = computed(() =>
    this.mesProjets()
      .filter((p) => p.stage === 'EN_ATTENTE_CONTACT_SUPPORT' || p.stage === 'EN_COURS_ANALYSE')
      .slice(0, 5));

  tonPriorite(priorite: string): string {
    switch (priorite) {
      case 'URGENTE': return 'hsl(var(--destructive))';
      case 'HAUTE': return 'hsl(var(--warning))';
      case 'MOYENNE': return 'hsl(var(--primary))';
      default: return 'hsl(var(--muted-foreground))';
    }
  }

  /** Un ticket ouvert sans première réponse : c'est lui qui fait la dette. */
  muet(t: Ticket): boolean {
    return !t.firstResponseAt;
  }

  ouvrirTicket(t: Ticket): void {
    this.router.navigate(['/support/tickets', t.id]);
  }

  ouvrirProjet(p: Projet): void {
    this.router.navigate(['/client/projets', p.id]);
  }

  allerA(lien?: string): void {
    if (lien) this.router.navigate([lien]);
  }

  // ═══════════════════════════════ Séries ═══════════════════════════════

  readonly serieEvolution = computed<ChartSeries[]>(() => {
    const a = this.analyse();
    if (!a) return [];
    return [
      { name: 'Reçus', values: a.evolution.map((d) => d.created), area: true, color: '#3b82f6' },
      { name: 'Résolus', values: a.evolution.map((d) => d.resolved), color: '#10b981' },
    ];
  });
  readonly joursEvolution = computed(() => this.analyse()?.evolution.map((d) => d.label) ?? []);

  readonly chargeHoraire = computed(() => this.analyse()?.chargeParHeure.map((h) => h.count) ?? []);
  readonly heuresLibelles = computed(() =>
    this.analyse()?.chargeParHeure.map((h) => `${String(h.hour).padStart(2, '0')} h`) ?? []);

  // ════════════════════════════ Répartitions ════════════════════════════

  readonly partsStatut = computed<ChartSlice[]>(() => {
    const palette = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b'];
    return (this.analyse()?.parStatut ?? [])
      .filter((k) => k.count > 0)
      .map((k, i) => ({
        name: traduire(LIBELLES_STATUT_TICKET, k.key),
        value: k.count,
        color: palette[i % palette.length],
      }));
  });

  readonly partsPriorite = computed<ChartSlice[]>(() => {
    const ordre = ['URGENTE', 'HAUTE', 'MOYENNE', 'BASSE'];
    const tons: Record<string, string> = {
      URGENTE: '#ef4444',
      HAUTE: '#f59e0b',
      MOYENNE: '#3b82f6',
      BASSE: '#94a3b8',
    };
    const par = this.analyse()?.parPriorite ?? [];
    return ordre
      .map((cle) => par.find((k) => k.key === cle))
      .filter((k): k is NonNullable<typeof k> => !!k)
      .map((k) => ({
        name: traduire(LIBELLES_PRIORITE_TICKET, k.key),
        value: k.count,
        color: tons[k.key] || '#3b82f6',
      }));
  });

  readonly partsType = computed<ChartSlice[]>(() => {
    const palette = ['#3b82f6', '#06b6d4'];
    return (this.analyse()?.parType ?? [])
      .filter((k) => k.count > 0)
      .map((k, i) => ({
        name: traduire(LIBELLES_TYPE_TICKET, k.key),
        value: k.count,
        color: palette[i % palette.length],
      }));
  });

  readonly partsAge = computed<ChartSlice[]>(() => {
    const tons = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
    return (this.analyse()?.ageBuckets ?? []).map((k, i) => ({
      name: traduire(LIBELLES_TRANCHE_AGE, k.key),
      value: k.count,
      color: tons[i] || '#3b82f6',
    }));
  });

  readonly agents = computed(() => this.analyse()?.topResolvers ?? []);

  /**
   * L'indicateur de tête passe au rouge dès qu'un ticket a dépassé son délai
   * de première réponse, ou qu'un urgent traîne : ce sont les deux seuls cas
   * où quelqu'un doit interrompre ce qu'il fait.
   */
  readonly alerte = computed(() => {
    const a = this.analyse();
    return !!a && (a.slaBreaches > 0 || a.critiques > 0);
  });

  readonly majAffichee = computed(() => {
    const d = this.derniereMaj();
    return d ? ilYA(d) : '';
  });
}
