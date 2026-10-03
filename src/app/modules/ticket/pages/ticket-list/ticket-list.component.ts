import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { ProjetService } from '../../../projet/services/projet.service';
import { AuthService } from '../../../../services';
import { Ticket, TicketStatut, TicketPriorite, TicketType, TicketRequest } from '../../models/ticket.models';
import { Projet } from '../../../projet/models/projet.models';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ticket-list.component.html',
})
export class TicketListComponent implements OnInit {
  private ticketSvc = inject(TicketService);
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);
  private route = inject(ActivatedRoute);

  loading = true;
  error = '';
  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  projets: Projet[] = []; // Liste des projets pour liaison
  activeTab: 'all' | TicketStatut = 'all';
  typeFilter: 'all' | TicketType = 'all';
  userRole = 'CLIENT';

  // Modal de création
  showCreateModal = false;
  creating = false;
  createError = '';
  newTicketForm: TicketRequest = {
    sujet: '',
    description: '',
    projetId: '',
    priorite: 'MOYENNE'
  };

  // Toast succès
  successMsg = '';

  /**
   * Ce que cette page montre : les discussions de projet, ou les reclamations.
   *
   * La distinction vient de la route, pas d'un second composant : les deux
   * listes se lisent, se filtrent et s'ouvrent exactement pareil. Seul le
   * client la voit — une question sur son projet et une reclamation ne se
   * rangent pas au meme endroit. Le support, lui, travaille sur les deux et
   * les recoit ensemble, avec son filtre pour trier.
   */

  /**
   * L'interne ne regarde que les projets qu'il suit.
   *
   * Par defaut, parce que c'est sa liste de travail : un support qui suit
   * quatre projets n'a pas a lire les quarante autres. Le bouton « Tous les
   * projets » reste la pour arbitrer ou reprendre un dossier laisse.
   */
  mesProjetsSeuls = true;

  basculerPortee(mesProjets: boolean) {
    if (this.mesProjetsSeuls === mesProjets) return;
    this.mesProjetsSeuls = mesProjets;
    this.load();
  }

  /**
   * Ou mene le dossier.
   *
   * Le client reste dans son espace : lui faire suivre "/support/tickets/..."
   * lui donne l'adresse de l'atelier pour lire son propre dossier.
   */
  lienFil(t: Ticket): string {
    return this.isExternalUser() ? '/client/support/' + t.id : '/support/tickets/' + t.id;
  }

  compteurLabel(n: number): string {
    return n > 1 ? `${n} tickets trouves` : `${n} ticket trouve`;
  }

  ngOnInit() {
    this.userRole = this.authSvc.role || 'CLIENT';
    if (this.userRole === 'SUPPORT_TECHNIQUE') {
      this.activeTab = 'OUVERT';
    }
    this.load();
    if (this.isExternalUser()) {
      this.loadProjects();
    }
  }

  load() {
    this.loading = true;
    this.error = '';

    // Sans type demande, le serveur rend consultations ET reclamations : le
    // client les trie ensuite avec le filtre, comme le support. Fixer le type
    // ici rendait ses consultations introuvables.
    const obs = this.isExternalUser()
      ? this.ticketSvc.getMesTickets(0, 100)
      : this.ticketSvc.getTickets(0, 100, undefined, undefined, this.mesProjetsSeuls);

    obs.subscribe({
      next: (page) => {
        this.tickets = page.content;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des tickets de support';
        this.loading = false;
      }
    });
  }

  loadProjects() {
    this.projetSvc.getMesProjets(0, 100).subscribe({
      next: (page) => {
        this.projets = page.content;
      },
      error: () => {
        console.warn('Impossible de charger la liste des projets pour liaison');
      }
    });
  }

  applyFilter() {
    let list = this.activeTab === 'all' ? [...this.tickets] : this.tickets.filter(t => t.statut === this.activeTab);
    if (this.typeFilter !== 'all') {
      list = list.filter(t => t.type === this.typeFilter);
    }
    this.filteredTickets = list;
  }

  switchTab(tabId: 'all' | TicketStatut) {
    this.activeTab = tabId;
    this.applyFilter();
  }

  /**
   * Combien de dossiers derriere chaque filtre.
   *
   * Le support voit les deux natures ensemble ; sans ce chiffre, il ne sait
   * pas si les trois reclamations qui l'attendent sont noyees sous douze
   * conversations de projet.
   */
  compteParType(type: 'all' | TicketType): number {
    const base = this.activeTab === 'all'
      ? this.tickets
      : this.tickets.filter(t => t.statut === this.activeTab);
    return type === 'all' ? base.length : base.filter(t => t.type === type).length;
  }

  /** Le nom du projet auquel le fil se rattache — vide pour une reclamation generale. */
  nomProjet(t: Ticket): string | null {
    if (!t.projetId) return null;
    return this.projets.find(p => p.id === t.projetId)?.nom ?? null;
  }

  switchTypeFilter(type: 'all' | TicketType) {
    this.typeFilter = type;
    this.applyFilter();
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

  getTabsForRole(): { id: 'all' | TicketStatut; label: string; icon: string }[] {
    return [
      { id: 'all', label: 'Tous', icon: '📁' },
      { id: 'OUVERT', label: 'Ouverts', icon: '🟢' },
      { id: 'EN_COURS', label: 'En cours', icon: '⚡' },
      { id: 'RESOLU', label: 'Résolus', icon: '🔵' },
      { id: 'FERME', label: 'Fermés', icon: '⚪' }
    ];
  }

  getTabCount(tabId: 'all' | TicketStatut): number {
    if (tabId === 'all') return this.tickets.length;
    return this.tickets.filter(t => t.statut === tabId).length;
  }

  openCreateModal() {
    this.newTicketForm = {
      sujet: '',
      description: '',
      projetId: '',
      priorite: 'MOYENNE'
    };
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  submitTicket() {
    if (!this.newTicketForm.sujet || !this.newTicketForm.description) {
      this.createError = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    this.creating = true;
    this.createError = '';

    // Nettoyer projetId si non sélectionné
    if (!this.newTicketForm.projetId) {
      delete this.newTicketForm.projetId;
    }

    this.ticketSvc.create(this.newTicketForm).subscribe({
      next: (ticket) => {
        this.creating = false;
        this.showCreateModal = false;
        this.showToast('Ticket créé avec succès !');
        this.load();
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.message || 'Erreur lors de la création du ticket';
      }
    });
  }

  showToast(msg: string) {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 4000);
  }

  // Esthétique : Badges & Priorités
  getPriorityLabel(prio: TicketPriorite): string {
    switch (prio) {
      case 'URGENTE': return 'Urgente';
      case 'HAUTE': return 'Haute';
      case 'MOYENNE': return 'Moyenne';
      case 'BASSE': return 'Basse';
    }
  }

  getPriorityStyle(prio: TicketPriorite) {
    switch (prio) {
      case 'URGENTE':
        return { background: 'rgba(239, 68, 68, 0.12)', color: 'rgb(248, 113, 113)', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'HAUTE':
        return { background: 'rgba(245, 158, 11, 0.12)', color: 'rgb(251, 191, 36)', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'MOYENNE':
        return { background: 'rgba(59, 130, 246, 0.12)', color: 'rgb(96, 165, 250)', border: '1px solid rgba(59, 130, 246, 0.3)' };
      case 'BASSE':
        return { background: 'rgba(100, 116, 139, 0.12)', color: 'rgb(148, 163, 184)', border: '1px solid rgba(100, 116, 139, 0.3)' };
    }
  }

  // Esthétique : Type de ticket (Consultation vs Réclamation — Partie D)
  getTypeLabel(type: TicketType): string {
    if (type === 'CANAL_PROJET') return 'Discussion projet';
    return type === 'CONSULTATION' ? 'Consultation' : 'Réclamation';
  }

  getTypeIcon(type: TicketType): string {
    if (type === 'CANAL_PROJET') return '💬';
    return type === 'CONSULTATION' ? '⚙️' : '📣';
  }

  getTypeStyle(type: TicketType) {
    if (type === 'CANAL_PROJET') {
      return { background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.15))', color: 'rgb(52, 211, 153)', border: '1px solid rgba(16, 185, 129, 0.35)' };
    }
    return type === 'CONSULTATION'
      ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.15))', color: 'rgb(129, 140, 248)', border: '1px solid rgba(99, 102, 241, 0.35)' }
      : { background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))', color: 'rgb(251, 191, 36)', border: '1px solid rgba(245, 158, 11, 0.35)' };
  }

  getStatusLabel(status: TicketStatut): string {
    switch (status) {
      case 'OUVERT': return 'Ouvert';
      case 'EN_COURS': return 'En cours';
      case 'RESOLU': return 'Résolu';
      case 'FERME': return 'Fermé';
    }
  }

  getStatusColor(status: TicketStatut): string {
    switch (status) {
      case 'OUVERT': return 'rgb(74, 222, 128)'; // vert
      case 'EN_COURS': return 'rgb(56, 189, 248)'; // cyan
      case 'RESOLU': return 'rgb(129, 140, 248)'; // indigo
      case 'FERME': return 'rgb(148, 163, 184)'; // gris
    }
  }

  getStatusBg(status: TicketStatut): string {
    switch (status) {
      case 'OUVERT': return 'rgba(74, 222, 128, 0.08)';
      case 'EN_COURS': return 'rgba(56, 189, 248, 0.08)';
      case 'RESOLU': return 'rgba(129, 140, 248, 0.08)';
      case 'FERME': return 'rgba(148, 163, 184, 0.08)';
    }
  }
}
