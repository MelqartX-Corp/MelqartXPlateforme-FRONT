import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TicketType, Ticket, TicketRequest, TicketStatut, TicketPriorite, Message, MessageRequest, StatsResponse, TicketAnalytics, ProjectDiscussion } from '../models/ticket.models';
import { Page } from '../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/tickets`;
  /**
   * Les conversations ont leur propre prefixe : la passerelle route par
   * prefixe, et /api/v1/projets/** part vers ms-projet, qui ne sait rien des
   * messages.
   */
  private discussionsBase = `${environment.services.gateway}${environment.apiVersion}/discussions`;

  /** Liste paginée des tickets (admin ou filtrée par userId/statut) */
  /**
   * @param mesProjets restreint aux projets que cet interne suit. La liste
   *                   complete reste accessible : elle sert a arbitrer et a
   *                   reprendre un dossier laisse, mais ce n'est pas celle sur
   *                   laquelle on travaille au quotidien.
   */
  getTickets(page = 0, size = 20, userId?: string, statut?: TicketStatut,
             mesProjets = false): Observable<Page<Ticket>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (userId) params = params.set('userId', userId);
    if (statut) params = params.set('statut', statut);
    if (mesProjets) params = params.set('mesProjets', true);
    return this.http.get<Page<Ticket>>(this.base, { params });
  }

  /** Mes tickets (userId extrait du JWT côté backend) */
  /**
   * @param type ce que le client vient consulter. Ses discussions de projet et
   *             ses reclamations vivent dans la meme collection mais ne se
   *             lisent pas au meme endroit. Absent, le serveur rend les
   *             reclamations.
   */
  getMesTickets(page = 0, size = 100, statut?: TicketStatut, type?: TicketType): Observable<Page<Ticket>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    if (type) params = params.set('type', type);
    return this.http.get<Page<Ticket>>(`${this.base}/me`, { params });
  }

  /** Détail d'un ticket */
  getTicket(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/${id}`);
  }

  /** Obtenir le ticket associé à un projet */
  getTicketByProjetId(projetId: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/projet/${projetId}`);
  }


  /**
   * Les conversations des projets auxquels l'utilisateur participe.
   *
   * Vaut pour un client comme pour un interne : c'est la meme question posee
   * au serveur, et la meme reponse.
   */
  getMesDiscussions(page = 0, size = 100): Observable<Page<ProjectDiscussion>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ProjectDiscussion>>(this.discussionsBase, { params });
  }

  /** Les messages de la conversation d'un projet. */
  getProjectMessages(projetId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.discussionsBase}/projet/${projetId}/messages`);
  }

  /** Ecrire dans la conversation d'un projet. Elle nait au premier message. */
  addProjectMessage(projetId: string, req: MessageRequest, nomProjet?: string): Observable<Message> {
    const params = nomProjet ? new HttpParams().set('nomProjet', nomProjet) : undefined;
    return this.http.post<Message>(
      `${this.discussionsBase}/projet/${projetId}/messages`, req, { params });
  }


  /** Créer un ticket */
  create(req: TicketRequest): Observable<Ticket> {
    return this.http.post<Ticket>(this.base, req);
  }

  /** Mettre à jour le statut d'un ticket */
  updateStatus(id: string, statut: TicketStatut): Observable<Ticket> {
    let params = new HttpParams().set('statut', statut);
    return this.http.put<Ticket>(`${this.base}/${id}/status`, {}, { params });
  }

  /** Reclasser la priorité d'un ticket (support technique, A2 — priorité hybride) */
  updatePriority(id: string, priorite: TicketPriorite): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.base}/${id}/priority`, { priorite });
  }

  /** Obtenir les messages d'un ticket */
  getMessages(ticketId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.base}/${ticketId}/messages`);
  }

  /** Ajouter un message à un ticket */
  addMessage(ticketId: string, req: MessageRequest): Observable<Message> {
    return this.http.post<Message>(`${this.base}/${ticketId}/messages`, req);
  }

  /** Obtenir les statistiques des tickets (ADMIN only) */
  getStats(): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.base}/stats`);
  }

  /**
   * GET /tickets/stats/analytics — séries, répartitions et qualité de service.
   *
   * Ouvert à l'administrateur et au support : c'est la file de ce dernier, et
   * la lui cacher n'aurait rien protégé — il en ouvre les tickets un par un
   * toute la journée.
   */
  getAnalytics(): Observable<TicketAnalytics> {
    return this.http.get<TicketAnalytics>(`${this.base}/stats/analytics`);
  }
}
