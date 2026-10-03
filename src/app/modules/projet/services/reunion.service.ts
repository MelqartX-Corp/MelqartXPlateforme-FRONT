import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Reunion,
  ReunionRequest,
  AnnulerReunionRequest,
  CreneauDisponible,
  DisponibiliteChefProjet,
  DisponibiliteRequest
} from '../models/reunion.models';

@Injectable({ providedIn: 'root' })
export class ReunionService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/projets`;

  /** Subject to trigger instant real-time sync across components whenever a meeting is booked/cancelled */
  public reunionUpdated$ = new Subject<void>();

  /** Récupère les créneaux disponibles pour le projet donné */
  getCreneauxDisponibles(projetId: string, dateDebut?: string, dateFin?: string): Observable<CreneauDisponible[]> {
    let params = new HttpParams();
    if (dateDebut) params = params.set('dateDebut', dateDebut);
    if (dateFin) params = params.set('dateFin', dateFin);
    return this.http.get<CreneauDisponible[]>(`${this.base}/${projetId}/creneaux-disponibles`, { params });
  }

  /** Le chef de projet peut-il recevoir une réservation ? (compte Google Agenda connecté) */
  getVisioDisponible(projetId: string): Observable<{ visioDisponible: boolean }> {
    return this.http.get<{ visioDisponible: boolean }>(`${this.base}/${projetId}/visio-disponible`);
  }

  /** Réserver une réunion pour un projet (Google Meet généré) */
  reserverReunion(projetId: string, req: ReunionRequest): Observable<Reunion> {
    return this.http.post<Reunion>(`${this.base}/${projetId}/reunions`, req).pipe(
      tap(() => this.reunionUpdated$.next())
    );
  }

  /** Liste toutes les réunions liées à un projet */
  getProjectReunions(projetId: string): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(`${this.base}/${projetId}/reunions`);
  }

  /** Récupère toutes les réunions de l'utilisateur connecté */
  getMyReunions(): Observable<Reunion[]> {
    return this.http.get<Reunion[]>(`${this.base}/reunions/me`);
  }

  /** Annuler une réunion */
  annulerReunion(reunionId: string, req: AnnulerReunionRequest): Observable<Reunion> {
    return this.http.put<Reunion>(`${this.base}/reunions/${reunionId}/annuler`, req).pipe(
      tap(() => this.reunionUpdated$.next())
    );
  }

  /** Récupérer mes disponibilités (Chef de Projet) */
  getMyDisponibilites(): Observable<DisponibiliteChefProjet> {
    return this.http.get<DisponibiliteChefProjet>(`${this.base}/disponibilites/me`);
  }

  /** Mettre à jour mes disponibilités (Chef de Projet) */
  updateMyDisponibilites(req: DisponibiliteRequest): Observable<DisponibiliteChefProjet> {
    return this.http.put<DisponibiliteChefProjet>(`${this.base}/disponibilites/me`, req);
  }

  // ── Google Calendar OAuth2 ────────────────────────────────────────────────

  /** Récupère l'URL d'autorisation Google OAuth2 */
  getGoogleAuthUrl(): Observable<{ authUrl: string }> {
    return this.http.get<{ authUrl: string }>(`${this.base}/disponibilites/google/auth-url`);
  }

  /** Traite le code OAuth2 de retour de Google et stocke les tokens */
  handleGoogleCallback(code: string, state?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/disponibilites/google/callback`, { code, state });
  }

  /** Déconnecte le compte Google du Chef de Projet */
  disconnectGoogle(): Observable<any> {
    return this.http.delete<any>(`${this.base}/disponibilites/google/disconnect`);
  }
}