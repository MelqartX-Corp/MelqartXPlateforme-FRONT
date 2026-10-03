import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../../../services';
import { Ticket, Message, TicketStatut, TicketPriorite, TicketType } from '../../models/ticket.models';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-ticket-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ticket-chat.component.html',
})
export class TicketChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private ticketSvc = inject(TicketService);
  private authSvc = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('chatWindow') private chatWindow!: ElementRef;

  ticketId = '';
  ticket: Ticket | null = null;
  messages: Message[] = [];
  newMessageContent = '';
  userRole = 'CLIENT';
  userId = '';

  loading = true;
  error = '';
  sending = false;
  updatingStatus = false;
  updatingPriority = false;

  private pollSubscription: Subscription | null = null;

  /**
   * Le meme ecran, lu comme une conversation plutot que comme un dossier.
   *
   * Le fil est techniquement un ticket — c'est lui qui porte les messages et
   * les droits. Mais le client qui pose une question sur son projet n'a pas
   * de dossier ouvert : lui montrer un identifiant, une priorite et un statut
   * de resolution lui fait croire qu'il a signale une panne.
   */
  estDiscussion = false;

  get retourLabel(): string {
    return this.estDiscussion ? 'Retour aux discussions' : 'Retour aux tickets';
  }

  ngOnInit() {
    this.userRole = this.authSvc.role || 'CLIENT';
    this.userId = this.authSvc.currentUser?.id || '';
    
    this.estDiscussion = this.route.snapshot.data['mode'] === 'discussion';
    if (this.estDiscussion) { try { localStorage.setItem('pcb_discussions_last_seen', new Date().toISOString()); } catch (_) {} }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ticketId = id;
      this.loadTicket();
      this.loadMessages();

      // Poll messages every 5 seconds for simulation of live chat
      this.pollSubscription = interval(5000).subscribe(() => {
        this.loadMessages(true);
      });
    } else {
      this.error = 'Identifiant du ticket introuvable';
      this.loading = false;
    }
  }

  ngOnDestroy() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  loadTicket() {
    this.ticketSvc.getTicket(this.ticketId).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
      },
      error: () => {
        this.error = 'Impossible de charger les détails du ticket';
      }
    });
  }

  loadMessages(silent = false) {
    if (!silent) this.loading = true;
    this.ticketSvc.getMessages(this.ticketId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loading = false;
        if (!silent) {
          setTimeout(() => this.scrollToBottom(), 100);
        }
      },
      error: () => {
        this.error = 'Impossible de charger l\'historique des messages';
        this.loading = false;
      }
    });
  }

  sendMessage() {
    if (!this.newMessageContent.trim() || this.sending) return;

    this.sending = true;
    const content = this.newMessageContent.trim();
    
    this.ticketSvc.addMessage(this.ticketId, { content }).subscribe({
      next: (msg) => {
        this.messages.push(msg);
        this.newMessageContent = '';
        this.sending = false;
        setTimeout(() => this.scrollToBottom(), 50);

        // Si le statut était OUVERT et que c'est le Support Technique qui répond,
        // le statut passe automatiquement à EN_COURS
        if (this.ticket && this.ticket.statut === 'OUVERT' && this.isSupportTechnique()) {
          this.changeStatus('EN_COURS');
        }
      },
      error: () => {
        this.sending = false;
      }
    });
  }

  changeStatus(newStatus: TicketStatut) {
    if (!this.ticket || this.updatingStatus) return;
    this.updatingStatus = true;

    this.ticketSvc.updateStatus(this.ticketId, newStatus).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.updatingStatus = false;
        this.loadMessages(true); // Recharger messages pour voir l'éventuelle trace system
      },
      error: () => {
        this.updatingStatus = false;
      }
    });
  }

  /** Reclasser la priorité (A2, support technique uniquement — priorité hybride) */
  changePriority(newPriorite: TicketPriorite) {
    if (!this.ticket || this.updatingPriority || this.ticket.priorite === newPriorite) return;
    this.updatingPriority = true;

    this.ticketSvc.updatePriority(this.ticketId, newPriorite).subscribe({
      next: (updatedTicket) => {
        this.ticket = updatedTicket;
        this.updatingPriority = false;
      },
      error: () => {
        this.updatingPriority = false;
      }
    });
  }

  private scrollToBottom(): void {
    try {
      if (this.chatWindow) {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      }
    } catch (err) { }
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

  isSupportTechnique(): boolean {
    return this.userRole === 'SUPPORT_TECHNIQUE';
  }

  isMe(senderId: string): boolean {
    return this.userId === senderId;
  }

  // Helpers de design
  getPriorityLabel(prio?: TicketPriorite): string {
    if (!prio) return '';
    switch (prio) {
      case 'URGENTE': return 'Urgente';
      case 'HAUTE': return 'Haute';
      case 'MOYENNE': return 'Moyenne';
      case 'BASSE': return 'Basse';
    }
  }

  getPriorityStyle(prio?: TicketPriorite) {
    if (!prio) return {};
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

  getTypeLabel(type?: TicketType): string {
    if (!type) return '';
    if (type === 'CANAL_PROJET') return 'Discussion projet';
    return type === 'CONSULTATION' ? 'Consultation' : 'Réclamation';
  }

  getTypeIcon(type?: TicketType): string {
    if (type === 'CANAL_PROJET') return '💬';
    return type === 'CONSULTATION' ? '⚙️' : '📣';
  }

  getTypeStyle(type?: TicketType) {
    if (!type) return {};
    return type === 'CONSULTATION'
      ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.15))', color: 'rgb(129, 140, 248)', border: '1px solid rgba(99, 102, 241, 0.35)' }
      : { background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))', color: 'rgb(251, 191, 36)', border: '1px solid rgba(245, 158, 11, 0.35)' };
  }

  getStatusLabel(status?: TicketStatut): string {
    if (!status) return '';
    switch (status) {
      case 'OUVERT': return 'Ouvert';
      case 'EN_COURS': return 'En cours';
      case 'RESOLU': return 'Résolu';
      case 'FERME': return 'Fermé';
    }
  }

  getStatusColor(status?: TicketStatut): string {
    if (!status) return '';
    switch (status) {
      case 'OUVERT': return 'rgb(74, 222, 128)';
      case 'EN_COURS': return 'rgb(56, 189, 248)';
      case 'RESOLU': return 'rgb(129, 140, 248)';
      case 'FERME': return 'rgb(148, 163, 184)';
    }
  }

  getStatusBg(status?: TicketStatut): string {
    if (!status) return '';
    switch (status) {
      case 'OUVERT': return 'rgba(74, 222, 128, 0.08)';
      case 'EN_COURS': return 'rgba(56, 189, 248, 0.08)';
      case 'RESOLU': return 'rgba(129, 140, 248, 0.08)';
      case 'FERME': return 'rgba(148, 163, 184, 0.08)';
    }
  }

  goBack() {
    if (this.estDiscussion) {
      this.router.navigate([this.isExternalUser() ? '/client/discussions' : '/support/tickets']);
      return;
    }
    if (this.isExternalUser()) {
      this.router.navigate(['/client/support']);
    } else {
      this.router.navigate(['/support/tickets']);
    }
  }
}
