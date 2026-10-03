import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { TicketService } from '../../services/ticket.service';
import { ProjetService } from '../../../projet/services/projet.service';
import { AuthService } from '../../../../services';
import { Message } from '../../models/ticket.models';

/**
 * La conversation d'un projet.
 *
 * Adressee par le projet, pas par un identifiant de fil : il n'y a rien a
 * ouvrir ni a retrouver. Aucun statut, aucune priorite, aucun bouton de
 * resolution — la page ne montre que ce qui existe reellement ici, des
 * messages.
 */
@Component({
  selector: 'app-project-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-chat.component.html'
})
export class ProjectChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private ticketSvc = inject(TicketService);
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('chatWindow') private chatWindow!: ElementRef;

  projetId = '';
  /**
   * Le nom du projet, charge des l'ouverture.
   *
   * Sans lui, la page ne dit pas de quoi on parle : arrive depuis une
   * notification, on lit un fil de messages sans savoir a quel projet il se
   * rattache. Il sert aussi a nommer la conversation le jour ou elle est
   * creee — sinon la liste affiche « Projet » pour tout le monde.
   */
  projetNom = '';
  messages: Message[] = [];
  nouveau = '';

  loading = true;
  envoi = false;
  error = '';

  /**
   * Le projet n'est pas le sien.
   *
   * Distinct d'une erreur de chargement : l'un se reessaie, l'autre non. La
   * page affichait le refus ET la zone de saisie — elle disait « vous n'avez
   * pas votre place ici » sous un champ qui invitait a ecrire, et le message
   * repartait en 403.
   */
  accesRefuse = false;

  private poll: Subscription | null = null;
  private doitDefiler = false;

  get userId(): string {
    return this.authSvc.currentUser?.id || '';
  }

  get externe(): boolean {
    const role = this.authSvc.role;
    return role === 'CLIENT' || role === 'CLIENT_ENTREPRISE' || role === 'INGENIEUR';
  }

  ngOnInit(): void {
    this.projetId = this.route.snapshot.paramMap.get('projetId')
      || this.route.snapshot.paramMap.get('id') || '';
    if (!this.projetId) {
      this.error = 'Projet introuvable.';
      this.loading = false;
      return;
    }

    this.chargerProjet();
    this.charger();
    // Pas de websocket sur cette pile : on relit toutes les cinq secondes,
    // sans montrer de chargement pour ne pas faire clignoter le fil.
    this.poll = interval(5000).subscribe(() => this.charger(true));
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.doitDefiler && this.chatWindow) {
      this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      this.doitDefiler = false;
    }
  }

  private chargerProjet(): void {
    this.projetSvc.getProjet(this.projetId).subscribe({
      next: (projet) => { this.projetNom = projet?.nom || ''; },
      // Le nom manquant ne doit pas empecher de lire la conversation.
      error: () => { this.projetNom = ''; }
    });
  }

  private charger(silencieux = false): void {
    if (!silencieux) this.loading = true;
    this.ticketSvc.getProjectMessages(this.projetId).subscribe({
      next: (messages) => {
        const nouveaux = messages.length !== this.messages.length;
        this.messages = messages;
        this.loading = false;
        if (nouveaux) this.doitDefiler = true;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 403) {
          this.accesRefuse = true;
          // Rien a attendre d'une relecture : on cesse de redemander toutes
          // les cinq secondes une porte qui restera fermee.
          this.poll?.unsubscribe();
          this.poll = null;
          return;
        }
        if (!silencieux) {
          this.error = err?.error?.message || "Cette conversation ne vous est pas ouverte.";
        }
      }
    });
  }

  envoyer(): void {
    const contenu = this.nouveau.trim();
    if (!contenu || this.envoi) return;

    this.envoi = true;
    this.ticketSvc.addProjectMessage(this.projetId, { content: contenu }, this.projetNom).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.nouveau = '';
        this.envoi = false;
        this.doitDefiler = true;
      },
      error: (err) => {
        this.envoi = false;
        this.error = err?.error?.message || "Le message n'a pas pu être envoyé.";
      }
    });
  }

  estMoi(message: Message): boolean {
    return message.senderId === this.userId;
  }

  retour(): void {
    this.router.navigate([this.externe ? '/client/discussions' : '/support/discussions']);
  }

  versProjet(): void {
    this.router.navigate(['/client/projets', this.projetId]);
  }

  roleLisible(role?: string): string {
    switch (role) {
      case 'SUPPORT_TECHNIQUE': return 'Support technique';
      case 'CHEF_DE_PROJET': return 'Chef de projet';
      case 'TECHNICIEN': return 'Atelier';
      case 'ADMINISTRATEUR':
      case 'ADMIN': return 'Administration';
      case 'INGENIEUR': return 'Ingénieur';
      default: return 'Client';
    }
  }
}
