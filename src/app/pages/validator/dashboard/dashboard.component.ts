import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { ProfileService } from '../../../services';
import { ProjetService } from '../../../modules/projet/services/projet.service';
import { ReunionService } from '../../../modules/projet/services/reunion.service';
import { ProjetStats, Projet } from '../../../modules/projet/models/projet.models';
import { Reunion } from '../../../modules/projet/models/reunion.models';
import { BillingService } from '../../../modules/billing/services/billing.service';
import { BillingAnalytics } from '../../../modules/billing/models/billing.models';

import {
  ChartAreaComponent, ChartBarsComponent, ChartDonutComponent,
  ChartRankingComponent, ChartGaugeComponent,
  ChartSeries, ChartSlice, STATUS_COLORS, formatFull, formatCompact,
} from '../../../shared/charts';
import { DashIconComponent, StatTileComponent, StatTile } from '../../../shared/ui';
import {
  LIBELLES_STATUT_PROJET, LIBELLES_OBJECTIF, LIBELLES_ETAPE_PROJET,
  LIBELLES_DELAI, LIBELLES_STATUT_DEVIS,
  traduire, ilYA,
} from '../../../shared/dashboard-labels';

/**
 * Le tableau de bord du chef de projet.
 *
 * Le rôle arrivait jusqu'ici directement sur son calendrier : il voyait ses
 * rendez-vous mais ni sa charge, ni ce qui l'attendait. Cette page répond
 * d'abord à « qu'est-ce que je dois faire aujourd'hui », et seulement ensuite
 * à « comment ça se passe ».
 *
 * Tout y est cadré sur ses propres affectations — le serveur restreint le
 * périmètre, la page ne fait pas semblant de filtrer.
 */
@Component({
  selector: 'app-cdp-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule,
    ChartAreaComponent, ChartBarsComponent, ChartDonutComponent,
    ChartRankingComponent, ChartGaugeComponent,
    DashIconComponent, StatTileComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class CdpDashboardComponent implements OnInit {
  private profileService = inject(ProfileService);
  private projetService = inject(ProjetService);
  private reunionService = inject(ReunionService);
  private billingService = inject(BillingService);
  private router = inject(Router);

  readonly userName = signal('');
  /** Requêtes encore sans réponse : chaque bloc s'affiche dès que la sienne arrive. */
  private readonly enCours = signal<Set<string>>(new Set());
  readonly chargement = computed(() => this.enCours().size > 0);
  readonly derniereMaj = signal<Date | null>(null);
  readonly enErreur = signal<Set<string>>(new Set());

  readonly stats = signal<ProjetStats | null>(null);
  readonly facturation = signal<BillingAnalytics | null>(null);
  readonly mesProjets = signal<Projet[]>([]);
  readonly projetsLibres = signal<Projet[]>([]);
  readonly reunions = signal<Reunion[]>([]);

  protected readonly formatFull = formatFull;
  protected readonly formatCompact = formatCompact;
  protected readonly traduire = traduire;
  protected readonly LIBELLES_STATUT_PROJET = LIBELLES_STATUT_PROJET;
  protected readonly LIBELLES_ETAPE_PROJET = LIBELLES_ETAPE_PROJET;

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (u) => this.userName.set(u.prenom || u.nom || ''),
      error: () => this.userName.set(''),
    });
    this.charger();
  }

  /**
   * Chaque requête remplit son bloc dès qu'elle répond. Les attendre toutes
   * ensemble faisait patienter la page entière sur le service le plus lent,
   * typiquement un service qui redémarre après une période d'inactivité.
   */
  charger(): void {
    this.enCours.set(new Set(['stats', 'facturation', 'assignes', 'libres', 'reunions']));
    this.enErreur.set(new Set());

    this.suivre('stats', 'projets', this.projetService.getProjetStats(),
      (s) => this.stats.set(s));
    this.suivre('facturation', 'facturation', this.billingService.getAnalytics(),
      (f) => this.facturation.set(f));
    this.suivre('assignes', 'projets', this.projetService.getMesProjetsAssignes(0, 50),
      (page: any) => this.mesProjets.set(page?.content ?? []));
    this.suivre('libres', 'projets', this.projetService.getProjetsNonAssignes('CHEF_DE_PROJET', 0, 10),
      (page: any) => this.projetsLibres.set(page?.content ?? []));
    this.suivre('reunions', 'reunions', this.reunionService.getMyReunions(),
      (r) => this.reunions.set(r ?? []));
  }

  private suivre<T>(requete: string, domaine: string, source: Observable<T>, appliquer: (valeur: T) => void): void {
    source.pipe(finalize(() => this.terminer(requete))).subscribe({
      next: appliquer,
      error: () => this.enErreur.update((e) => new Set(e).add(domaine)),
    });
  }

  private terminer(requete: string): void {
    const restantes = new Set(this.enCours());
    restantes.delete(requete);
    this.enCours.set(restantes);
    if (!restantes.size) this.derniereMaj.set(new Date());
  }

  /** Vrai tant que la requête n'a pas répondu : un bloc vide n'est pas encore « vide ». */
  enAttente(requete: string): boolean {
    return this.enCours().has(requete);
  }

  cleTuile(_: number, t: StatTile): string {
    return t.label;
  }

  echoue(domaine: string): boolean {
    return this.enErreur().has(domaine);
  }

  // ═══════════════════════════════ Tuiles ═══════════════════════════════

  readonly tuiles = computed<StatTile[]>(() => {
    const s = this.stats();
    const f = this.facturation();
    const out: StatTile[] = [];
    if (!s) return out;

    out.push({
      label: 'Mes projets', value: formatFull(s.total), icon: 'kanban', ton: 'primary',
      sub: `${s.enCours} en cours · ${s.livres} livrés`,
      spark: s.evolution.map((e) => e.crees),
      lien: '/client/projets',
    });
    out.push({
      label: "Réunions aujourd'hui", value: formatFull(s.reunionsAujourdhui), icon: 'calendar',
      ton: s.reunionsAujourdhui > 0 ? 'warning' : 'accent',
      sub: `${s.reunionsCetteSemaine} cette semaine`,
      lien: '/validator/calendar',
    });
    out.push({
      label: 'Réunions à venir', value: formatFull(s.reunionsPlanifiees), icon: 'clock', ton: 'accent',
      sub: `${s.reunionsTerminees} déjà tenues`,
      lien: '/validator/calendar',
    });
    out.push({
      label: 'En attente client', value: formatFull(s.enAttenteClient), icon: 'hourglass',
      // Ce compteur ne mesure pas une performance : il indique où relancer.
      ton: s.enAttenteClient > 0 ? 'warning' : 'success',
      sub: 'une relance débloque le dossier',
    });

    if (f) {
      out.push({
        label: 'Devis émis', value: formatFull(f.totalQuotes), icon: 'file-text', ton: 'accent',
        sub: `${f.pendingQuotes} en attente de réponse`,
        spark: f.quotesByMonth.map((m) => m.count),
        lien: '/validator/quotes',
      });
      out.push({
        label: 'Taux d\'acceptation', value: `${f.conversionRate}%`, icon: 'trending', ton: 'success',
        sub: `${f.acceptedQuotes} devis acceptés`,
        spark: f.quotesByMonth.map((m) => (m.count > 0 ? (m.accepted / m.count) * 100 : 0)),
      });
    }

    out.push({
      label: 'Âge moyen', value: s.ageMoyenOuvertsJours != null ? `${s.ageMoyenOuvertsJours} j` : '—',
      icon: 'clock', ton: 'primary', sub: 'de mes projets ouverts',
    });

    // Un projet qui attend d'etre contacte n'attend personne d'autre que le
    // chef de projet : c'est la seule file ou son inaction se voit, et elle
    // n'etait affichee nulle part.
    if (s.enAttenteContact != null) {
      out.push({
        label: 'À contacter', value: `${s.enAttenteContact}`, icon: 'message',
        ton: s.enAttenteContact > 0 ? 'warning' : 'success',
        sub: 'projets en attente de prise de contact',
        lien: '/client/projets',
      });
    }

    // Le delai de bout en bout de ses propres projets — ce que le client
    // ressent, et le seul chiffre qui dit si les promesses tiennent.
    if (s.delaiMoyenLivraisonJours != null) {
      out.push({
        label: 'Délai de livraison', value: `${s.delaiMoyenLivraisonJours} j`,
        icon: 'truck', ton: 'accent', sub: 'moyenne sur mes projets livrés',
      });
    }

    if (s.noteMoyenne != null) {
      out.push({
        label: 'Ma note', value: `${s.noteMoyenne}/5`, icon: 'star',
        ton: s.noteMoyenne >= 4 ? 'success' : s.noteMoyenne >= 3 ? 'warning' : 'destructive',
        sub: `${s.avisRecus} avis client(s)`,
      });
    }

    return out;
  });

  // ══════════════════════════ Ce qu'il faut faire ══════════════════════════

  /**
   * Les prochaines réunions, la plus proche d'abord.
   *
   * Les annulées sont écartées : elles n'appellent aucune action et
   * repousseraient hors de la liste des rendez-vous qui, eux, ont lieu.
   */
  readonly prochainesReunions = computed(() => {
    const maintenant = Date.now();
    return this.reunions()
      .filter((r) => r.statut !== 'ANNULEE' && new Date(r.dateDebut).getTime() >= maintenant)
      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
      .slice(0, 6);
  });

  /** Les projets dont l'étape appelle une action du chef de projet. */
  readonly aTraiter = computed(() => {
    const bloquants = new Set([
      'EN_ATTENTE_CONTACT_SUPPORT', 'EN_COURS_ANALYSE',
      'REDACTION_CAHIER_CHARGES', 'BOM_ANALYSEE', 'PRET_POUR_FLUX',
    ]);
    return this.mesProjets()
      .filter((p) => p.stage && bloquants.has(p.stage))
      .slice(0, 6);
  });

  readonly aReprendre = computed(() => this.projetsLibres().slice(0, 5));

  quandReunion(r: Reunion): string {
    const d = new Date(r.dateDebut);
    const aujourdhui = new Date();
    const memeJour = d.toDateString() === aujourdhui.toDateString();
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (memeJour) return `Aujourd'hui ${heure}`;

    const demain = new Date(aujourdhui);
    demain.setDate(demain.getDate() + 1);
    if (d.toDateString() === demain.toDateString()) return `Demain ${heure}`;

    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + heure;
  }

  imminente(r: Reunion): boolean {
    const dans = new Date(r.dateDebut).getTime() - Date.now();
    return dans > 0 && dans < 2 * 3600 * 1000;
  }

  // ═══════════════════════════════ Séries ═══════════════════════════════

  readonly serieProjets = computed<ChartSeries[]>(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { name: 'Créés', values: s.evolution.map((e) => e.crees), area: true, color: '#3b82f6' },
      { name: 'Livrés', values: s.evolution.map((e) => e.livres), color: '#10b981' },
    ];
  });
  readonly moisProjets = computed(() => this.stats()?.evolution.map((e) => e.label) ?? []);

  readonly serieDevis = computed<ChartSeries[]>(() => {
    const f = this.facturation();
    if (!f) return [];
    return [
      { name: 'Émis', values: f.quotesByMonth.map((m) => m.count), color: '#06b6d4' },
      { name: 'Acceptés', values: f.quotesByMonth.map((m) => m.accepted), color: '#10b981' },
    ];
  });
  readonly moisDevis = computed(() => this.facturation()?.quotesByMonth.map((m) => m.label) ?? []);

  // ════════════════════════════ Répartitions ════════════════════════════

  readonly partsStatut = computed<ChartSlice[]>(() => {
    const palette = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];
    return (this.stats()?.parStatut ?? [])
      .filter((r) => r.nombre > 0)
      .map((r, i) => ({
        name: traduire(LIBELLES_STATUT_PROJET, r.cle),
        value: r.nombre,
        color: palette[i % palette.length],
      }));
  });

  readonly partsObjectif = computed<ChartSlice[]>(() => {
    const palette = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981'];
    return (this.stats()?.parObjectif ?? [])
      .filter((r) => r.nombre > 0)
      .map((r, i) => ({
        name: traduire(LIBELLES_OBJECTIF, r.cle),
        value: r.nombre,
        color: palette[i % palette.length],
      }));
  });

  readonly partsEtape = computed<ChartSlice[]>(() => {
    const palette = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#6366f1', '#0ea5e9'];
    return (this.stats()?.parStage ?? [])
      .map((r, i) => ({
        name: traduire(LIBELLES_ETAPE_PROJET, r.cle),
        value: r.nombre,
        color: palette[i % palette.length],
      }));
  });

  /** L'urgence déclarée au cadrage : elle dicte l'ordre de traitement. */
  readonly partsDelai = computed<ChartSlice[]>(() => {
    const tons: Record<string, string> = {
      URGENT: '#ef4444',
      ONE_TO_THREE_MONTHS: '#f59e0b',
      THREE_TO_SIX_MONTHS: '#3b82f6',
      SIX_PLUS_MONTHS: '#94a3b8',
    };
    return (this.stats()?.parTimeline ?? [])
      .map((r) => ({
        name: traduire(LIBELLES_DELAI, r.cle),
        value: r.nombre,
        color: tons[r.cle] || '#3b82f6',
      }));
  });

  readonly partsStatutDevis = computed<ChartSlice[]>(() => {
    const palette = ['#06b6d4', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
    return (this.facturation()?.quotesByStatus ?? [])
      .filter((k) => k.count > 0)
      .map((k, i) => ({
        name: traduire(LIBELLES_STATUT_DEVIS, k.key),
        value: k.count,
        hint: `${formatCompact(k.amount)} TND`,
        color: palette[i % palette.length],
      }));
  });

  readonly majAffichee = computed(() => {
    const d = this.derniereMaj();
    return d ? ilYA(d) : '';
  });

  allerA(lien?: string): void {
    if (lien) this.router.navigate([lien]);
  }

  ouvrirProjet(p: Projet): void {
    this.router.navigate(['/client/projets', p.id]);
  }
}
