import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { ProductionStockService } from '../../services/production-stock.service';
import { ProjectTraceability } from '../../models/stock.models';

/**
 * Traçabilité d'un projet — d'où vient chaque pièce montée sur les cartes.
 *
 * Le serveur tenait ce registre depuis le premier retour de production : à
 * chaque décompte, la ligne écrite dans stock_movements retient la bobine, son
 * lot, son fournisseur et sa date. Rien ne le lisait.
 *
 * C'est pourtant la réponse à la seule question qui compte le jour d'un
 * défaut série : quelles cartes portent le même lot que celle qui est tombée.
 */
@Component({
  selector: 'app-project-traceability',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-traceability.component.html'
})
export class ProjectTraceabilityComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private prodSvc = inject(ProductionStockService);

  chargement = signal(true);
  erreur = signal<string | null>(null);
  trace = signal<ProjectTraceability | null>(null);

  /** Référence dépliée — une seule à la fois, la liste reste lisible. */
  ouverte = signal<string | null>(null);

  readonly composants = computed(() => this.trace()?.components ?? []);

  /**
   * Lots distincts engagés dans le projet.
   *
   * C'est par là qu'un rappel commence : on part d'un lot suspect, pas d'une
   * référence.
   */
  readonly lots = computed(() => {
    const vus = new Map<string, { lot: string; fournisseur: string; pieces: number; refs: Set<string> }>();
    for (const c of this.composants()) {
      for (const r of c.reels) {
        const cle = r.manufacturerLot || r.lotId || '—';
        const ligne = vus.get(cle) ?? {
          lot: cle,
          fournisseur: r.supplierName ?? '—',
          pieces: 0,
          refs: new Set<string>()
        };
        ligne.pieces += r.quantity;
        if (c.mpn) ligne.refs.add(c.mpn);
        vus.set(cle, ligne);
      }
    }
    return [...vus.values()].sort((a, b) => b.pieces - a.pieces);
  });

  readonly totalBobines = computed(() =>
    this.composants().reduce((total, c) => total + c.reels.length, 0));

  ngOnInit(): void {
    const projetId = this.route.snapshot.paramMap.get('projetId');
    if (!projetId) {
      this.erreur.set('Projet introuvable.');
      this.chargement.set(false);
      return;
    }

    this.prodSvc.traceability(projetId).subscribe({
      next: trace => {
        this.trace.set(trace);
        this.chargement.set(false);
      },
      error: err => {
        this.erreur.set(err?.error?.message
          ?? "Aucune traçabilité pour ce projet — aucune pièce n'a encore été décomptée.");
        this.chargement.set(false);
      }
    });
  }

  basculer(componentId: string): void {
    this.ouverte.set(this.ouverte() === componentId ? null : componentId);
  }

  /** Une référence servie par plusieurs lots est le cas à surveiller. */
  lotsDe(reels: ProjectTraceability['components'][number]['reels']): number {
    return new Set(reels.map(r => r.manufacturerLot || r.lotId || '—')).size;
  }
}
