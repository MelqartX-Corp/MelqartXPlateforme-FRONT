import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InstantQuotePanelComponent } from '../../components/instant-quote-panel/instant-quote-panel.component';
import { ProjetService } from '../../../projet/services/projet.service';
import { Projet } from '../../../projet/models/projet.models';
import { environment } from '../../../../../environments/environment';

/**
 * La page du devis d'un projet.
 *
 * Elle existe pour un moment précis : celui qui suit la validation de la BOM.
 * Le client vient d'arbitrer ses composants un par un ; ce qu'il attend
 * ensuite, c'est un prix. Le lui faire chercher dans un onglet de la fiche
 * projet, entre les documents et les réunions, gâche le seul instant du
 * parcours où il est prêt à commander.
 *
 * Le chiffrage lui-même reste dans le panneau partagé : c'est la même
 * simulation que dans la fiche projet, pas une seconde implémentation qui
 * finirait par diverger.
 */
@Component({
  selector: 'app-devis-projet',
  standalone: true,
  imports: [CommonModule, RouterModule, InstantQuotePanelComponent],
  templateUrl: './devis-projet.component.html'
})
export class DevisProjetComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projetSvc = inject(ProjetService);

  projet = signal<Projet | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  /**
   * Vrai quand on arrive directement de la validation de la BOM.
   *
   * Le bandeau de félicitations n'a de sens que dans cet enchaînement : revenu
   * ici trois jours plus tard, le client n'a pas besoin qu'on lui annonce une
   * nouvelle qu'il connaît.
   */
  bomValidee = signal(false);

  ngOnInit(): void {
    this.bomValidee.set(this.route.snapshot.queryParamMap.get('bomValidee') === '1');

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/client/projets']);
      return;
    }

    // Devis instantané désactivé : la page n'a plus rien à montrer, on renvoie
    // vers la fiche projet (lien direct ou ancien favori).
    if (!environment.features.instantQuote) {
      this.router.navigate(['/client/projets', id], { replaceUrl: true });
      return;
    }

    this.projetSvc.getProjet(id).subscribe({
      next: (projet: Projet) => {
        this.projet.set(projet);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Ce projet est introuvable, ou ne vous appartient pas.");
        this.loading.set(false);
      }
    });
  }

  /**
   * Le devis instantané ne couvre que le prototype et la production.
   *
   * Ailleurs — une idée, une étude de faisabilité — le prix dépend d'un
   * cadrage humain, et un chiffrage automatique donnerait un chiffre faux avec
   * l'assurance d'un chiffre juste.
   */
  get eligible(): boolean {
    const objectif = this.projet()?.cadrage?.objectif;
    return objectif === 'PROTOTYPE' || objectif === 'PRODUCTION';
  }
}
