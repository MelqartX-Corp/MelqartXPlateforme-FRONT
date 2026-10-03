import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProjetService } from '../../services/projet.service';
import { FeedbackStats, ProjetFeedback } from '../../models/projet.models';

interface AgentAverage {
  nom: string;
  moyenne: number;
  count: number;
}

interface DistributionBar {
  note: number;
  count: number;
  pourcentage: number;
}

interface CritereAverage {
  cle: 'noteSupport' | 'noteCommunication' | 'noteProduit';
  label: string;
  icone: string;
  moyenne: number;
}

type FiltreAvis = 'tous' | 'positifs' | 'critiques';

@Component({
  selector: 'app-feedback-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './feedback-dashboard.component.html',
  styleUrl: './feedback-dashboard.component.css',
})
export class FeedbackDashboardComponent implements OnInit {
  private projetSvc = inject(ProjetService);

  loading = true;
  error = '';
  feedbacks: ProjetFeedback[] = [];
  totalElements = 0;

  /**
   * Statistiques calculees par le backend sur TOUTE la collection.
   * Les moyennes ne dependent donc plus de la page chargee ci-dessous, et les
   * classements sont groupes par identifiant d'agent (deux homonymes restent distincts).
   * Reste null si l'endpoint n'est pas disponible : on retombe alors sur le calcul local.
   */
  stats: FeedbackStats | null = null;

  recherche = '';
  filtre: FiltreAvis = 'tous';

  /** Seuils alignés sur le backend (LOW_RATING_THRESHOLD = 2.0) */
  private readonly SEUIL_CRITIQUE = 2;
  private readonly SEUIL_POSITIF = 4;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';
    // Les statistiques viennent du backend ; la liste ne sert plus qu'a afficher les cartes
    this.projetSvc.getFeedbackStats().subscribe({
      next: (stats) => this.stats = stats,
      error: () => this.stats = null   // repli sur le calcul local
    });

    this.projetSvc.listFeedback(0, 100).subscribe({
      next: (page) => {
        this.feedbacks = page.content;
        this.totalElements = page.totalElements;
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des avis clients';
        this.loading = false;
      }
    });
  }

  // ── Indicateurs ──────────────────────────────────────────────

  get averageNote(): number {
    if (this.stats) return this.stats.moyenneGlobale;
    if (this.feedbacks.length === 0) return 0;
    const sum = this.feedbacks.reduce((acc, f) => acc + f.moyenne, 0);
    return this.arrondi(sum / this.feedbacks.length);
  }

  /** Nombre d'étoiles pleines à afficher pour la note globale */
  get averageNoteArrondie(): number {
    return Math.round(this.averageNote);
  }

  /** Part des avis dont la moyenne atteint 4/5 — le « taux de clients satisfaits » */
  get tauxSatisfaction(): number {
    if (this.stats) return this.stats.tauxSatisfaction;
    if (this.feedbacks.length === 0) return 0;
    const satisfaits = this.feedbacks.filter(f => f.moyenne >= this.SEUIL_POSITIF).length;
    return Math.round((satisfaits / this.feedbacks.length) * 100);
  }

  /** Avis à traiter en priorité : les mêmes que ceux qui déclenchent l'alerte backend */
  get avisCritiques(): ProjetFeedback[] {
    return this.feedbacks.filter(f => f.moyenne <= this.SEUIL_CRITIQUE);
  }

  /** Répartition 5★ → 1★ sur la moyenne arrondie de chaque avis */
  get distribution(): DistributionBar[] {
    if (this.stats) {
      const total = this.stats.total;
      return this.stats.distribution.map(b => ({
        note: b.note,
        count: b.nombre,
        pourcentage: total ? Math.round((b.nombre / total) * 100) : 0
      }));
    }
    const total = this.feedbacks.length;
    return [5, 4, 3, 2, 1].map(note => {
      const count = this.feedbacks.filter(f => Math.round(f.moyenne) === note).length;
      return { note, count, pourcentage: total ? Math.round((count / total) * 100) : 0 };
    });
  }

  /** Moyenne par critère : montre lequel des trois axes tire la note vers le bas */
  get critereAverages(): CritereAverage[] {
    const criteres: CritereAverage[] = [
      { cle: 'noteSupport', label: 'Support', icone: '🎧', moyenne: 0 },
      { cle: 'noteCommunication', label: 'Communication & délais', icone: '💬', moyenne: 0 },
      { cle: 'noteProduit', label: 'Produit livré', icone: '📦', moyenne: 0 },
    ];
    if (this.stats) {
      const parCle: Record<string, number> = {
        noteSupport: this.stats.moyenneSupport,
        noteCommunication: this.stats.moyenneCommunication,
        noteProduit: this.stats.moyenneProduit
      };
      return criteres.map(c => ({ ...c, moyenne: parCle[c.cle] }));
    }
    if (this.feedbacks.length === 0) return criteres;
    return criteres.map(c => ({
      ...c,
      moyenne: this.arrondi(this.feedbacks.reduce((acc, f) => acc + f[c.cle], 0) / this.feedbacks.length)
    }));
  }

  /** Moyenne de la note « support » par agent — identifie qui accompagner */
  get supportAverages(): AgentAverage[] {
    if (this.stats) return this.versAgentAverage(this.stats.parAgentSupport);
    return this.groupAverage(this.feedbacks.filter(f => f.supportNom), f => f.supportNom!, f => f.noteSupport);
  }

  /** Moyenne de la note « communication/délais » par chef de projet */
  get cdpAverages(): AgentAverage[] {
    if (this.stats) return this.versAgentAverage(this.stats.parChefDeProjet);
    return this.groupAverage(this.feedbacks.filter(f => f.chefDeProjetNom), f => f.chefDeProjetNom!, f => f.noteCommunication);
  }

  /** Un agent sans nom resolu (compte supprime) reste identifiable par son identifiant */
  private versAgentAverage(stats: { agentId: string; nom?: string; moyenne: number; nombre: number }[]): AgentAverage[] {
    return stats.map(a => ({
      nom: a.nom || ('Agent ' + a.agentId.slice(-6)),
      moyenne: Math.round(a.moyenne * 10) / 10,
      count: a.nombre
    }));
  }

  /** Nombre total d'avis critiques (backend) — la liste ci-dessous ne couvre qu'une page */
  get nbAvisCritiques(): number {
    return this.stats ? this.stats.avisCritiques : this.avisCritiques.length;
  }

  // ── Liste filtrée ────────────────────────────────────────────

  get feedbacksFiltres(): ProjetFeedback[] {
    const q = this.recherche.trim().toLowerCase();
    return this.feedbacks.filter(f => {
      if (this.filtre === 'positifs' && f.moyenne < this.SEUIL_POSITIF) return false;
      if (this.filtre === 'critiques' && f.moyenne > this.SEUIL_CRITIQUE) return false;
      if (!q) return true;
      return [f.projetNom, f.commentaire, f.supportNom, f.chefDeProjetNom]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }

  setFiltre(filtre: FiltreAvis) {
    this.filtre = filtre;
  }

  // ── Helpers d'affichage ──────────────────────────────────────

  /** Initiales pour la pastille d'un agent ou d'un projet */
  initiales(nom: string | undefined): string {
    if (!nom) return '—';
    return nom.trim().split(/\s+/).slice(0, 2).map(m => m[0]?.toUpperCase() || '').join('');
  }

  /** Vert / ambre / rouge selon la note — même règle partout dans la page */
  couleurNote(note: number): string {
    if (note <= this.SEUIL_CRITIQUE) return 'hsl(var(--destructive))';
    if (note < this.SEUIL_POSITIF) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  }

  estCritique(note: number): boolean {
    return note <= this.SEUIL_CRITIQUE;
  }

  /** Largeur de barre en % pour une note sur 5 */
  largeurNote(note: number): number {
    return Math.max(0, Math.min(100, (note / 5) * 100));
  }

  private arrondi(valeur: number): number {
    return Math.round(valeur * 10) / 10;
  }

  private groupAverage(items: ProjetFeedback[], keyFn: (f: ProjetFeedback) => string, valueFn: (f: ProjetFeedback) => number): AgentAverage[] {
    const groups = new Map<string, number[]>();
    for (const item of items) {
      const key = keyFn(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(valueFn(item));
    }
    return Array.from(groups.entries())
      .map(([nom, notes]) => ({
        nom,
        moyenne: this.arrondi(notes.reduce((a, b) => a + b, 0) / notes.length),
        count: notes.length
      }))
      .sort((a, b) => b.moyenne - a.moyenne);
  }
}
