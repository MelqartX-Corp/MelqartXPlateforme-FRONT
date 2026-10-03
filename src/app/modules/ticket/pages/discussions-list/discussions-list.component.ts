import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../../../services';
import { ProjectDiscussion } from '../../models/ticket.models';

/**
 * Les conversations de projet.
 *
 * Volontairement pauvre : pas de compteurs, pas d'onglets par statut, pas de
 * priorite. Une conversation n'a rien de tout cela — on vient y lire des
 * echanges, pas solder des dossiers. L'ecran des tickets reste a cote pour ca.
 */
@Component({
  selector: 'app-discussions-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './discussions-list.component.html'
})
export class DiscussionsListComponent implements OnInit {
  private ticketSvc = inject(TicketService);
  private authSvc = inject(AuthService);
  private router = inject(Router);

  discussions = signal<ProjectDiscussion[]>([]);
  loading = signal(true);
  error = signal('');

  readonly vide = computed(() => !this.loading() && this.discussions().length === 0);

  ngOnInit(): void {
    this.ticketSvc.getMesDiscussions().subscribe({
      next: (page) => {
        this.discussions.set(page.content ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Les conversations n'ont pas pu être chargées.");
        this.loading.set(false);
      }
    });
  }

  private get externe(): boolean {
    const role = this.authSvc.role;
    return role === 'CLIENT' || role === 'CLIENT_ENTREPRISE' || role === 'INGENIEUR';
  }

  ouvrir(d: ProjectDiscussion): void {
    this.router.navigate([this.externe ? '/client/discussions' : '/support/discussions', d.projetId]);
  }

  /** Depuis quand le dernier message attend — en clair plutôt qu'en date. */
  depuis(iso?: string): string {
    if (!iso) return 'aucun message';
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    return `il y a ${Math.floor(heures / 24)} j`;
  }
}
