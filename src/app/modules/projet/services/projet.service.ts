import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Projet, ProjetRequest, ProjetUpdateRequest, ProjetStatut, ProjectStage, CadrageRequest, ProjectAssignRequest, AssignmentHistoryResponse, ProjectStockStatusResponse, BomResponse, UserWorkload, AlternativeProvider, AlternativeResponse, TransitionRequest, AlternativesDecisionRequest, BomComponentDecisionRequest, TypeDocumentProjet, DocumentProjet, DfmAnalysisResult, ProjetFeedback, ProjetFeedbackRequest, PendingFeedback, FeedbackStats, ProjetStats } from '../models/projet.models';

import { Page } from '../../../shared/models/shared.models';

@Injectable({ providedIn: 'root' })
export class ProjetService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/projets`;

  private myProjectsCache: Record<string, Page<Projet>> = {};

  clearCache() {
    this.myProjectsCache = {};
  }

  /** Liste paginée (admin ou filtrée par userId/statut) */
  getProjets(page = 0, size = 20, userId?: string, statut?: ProjetStatut): Observable<Page<Projet>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (userId) params = params.set('userId', userId);
    if (statut) params = params.set('statut', statut);
    return this.http.get<Page<Projet>>(this.base, { params });
  }

  /** Mes projets (userId extrait du JWT côté backend) avec cache en mémoire */
  getMesProjets(page = 0, size = 100, statut?: ProjetStatut, forceRefresh = false): Observable<Page<Projet>> {
    const cacheKey = `${page}_${size}_${statut || 'all'}`;
    if (!forceRefresh && this.myProjectsCache[cacheKey]) {
      return of(this.myProjectsCache[cacheKey]);
    }
    let params = new HttpParams().set('page', page).set('size', size);
    if (statut) params = params.set('statut', statut);
    return this.http.get<Page<Projet>>(`${this.base}/me`, { params }).pipe(
      tap(data => this.myProjectsCache[cacheKey] = data)
    );
  }

  /** Détail d'un projet */
  getProjet(id: string): Observable<Projet> {
    return this.http.get<Projet>(`${this.base}/${id}`);
  }

  /** Créer un projet (statut BROUILLON auto) */
  create(req: ProjetRequest): Observable<Projet> {
    return this.http.post<Projet>(this.base, req).pipe(tap(() => this.clearCache()));
  }

  /** Modifier un projet */
  update(id: string, req: ProjetUpdateRequest): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${id}`, req).pipe(tap(() => this.clearCache()));
  }

  /**
   * L'équipe arrête le projet d'elle-même — typiquement une étude qui aboutit
   * à « ce n'est pas réalisable ». Le motif part au client.
   */
  cancel(id: string, motif: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${id}/cancel`, { motif })
      .pipe(tap(() => this.clearCache()));
  }

  /**
   * Le client demande à annuler.
   *
   * Ce n'est pas une annulation : c'est une question. Pour un projet de
   * fabrication, le serveur y répond dans la seconde en lisant le journal du
   * stock ; pour une étude, elle part au chef de projet, seul à savoir s'il a
   * commencé. Le statut renvoyé dit lequel des deux s'est produit.
   */
  demanderAnnulation(id: string, motif: string): Observable<Projet> {
    return this.http.post<Projet>(`${this.base}/${id}/annulation/demande`, { motif })
      .pipe(tap(() => this.clearCache()));
  }

  /** L'équipe accepte : le travail n'avait pas commencé. */
  accepterAnnulation(id: string): Observable<Projet> {
    return this.http.post<Projet>(`${this.base}/${id}/annulation/accepter`, {})
      .pipe(tap(() => this.clearCache()));
  }

  /** L'équipe refuse : le travail a commencé. Le motif part au client. */
  refuserAnnulation(id: string, motif: string): Observable<Projet> {
    return this.http.post<Projet>(`${this.base}/${id}/annulation/refuser`, { motif })
      .pipe(tap(() => this.clearCache()));
  }

  archive(id: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${id}/archive`, null).pipe(tap(() => this.clearCache()));
  }

  /** Mettre à jour le cadrage (sauvegarde progressive) */
  updateCadrage(projetId: string, req: CadrageRequest): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projetId}/cadrage`, req).pipe(tap(() => this.clearCache()));
  }

  /** Supprimer un projet (ADMIN only) */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(tap(() => this.clearCache()));
  }


  // ═══════════════════════════════════════════════════
  // Project Assignment API Integration
  // ═══════════════════════════════════════════════════

  /** Affecter un collaborateur à un projet */
  assign(id: string, req: ProjectAssignRequest): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${id}/assign`, req);
  }

  /** Chef de Projet ou Support s'auto-affecte à un projet */
  selfAssign(id: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${id}/self-assign`, null);
  }

  /** Récupérer l'historique des affectations */
  getAssignmentHistory(id: string): Observable<AssignmentHistoryResponse[]> {
    return this.http.get<AssignmentHistoryResponse[]>(`${this.base}/${id}/assignment-history`);
  }

  /** Récupérer mes projets affectés */
  getMesProjetsAssignes(page = 0, size = 20): Observable<Page<Projet>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Projet>>(`${this.base}/my-assigned`, { params });
  }

  /** Récupérer les projets non affectés */
  getProjetsNonAssignes(role = 'all', page = 0, size = 20): Observable<Page<Projet>> {
    const params = new HttpParams().set('role', role).set('page', page).set('size', size);
    return this.http.get<Page<Projet>>(`${this.base}/unassigned`, { params });
  }

  /** Récupère le BOM d'un projet (collection séparée) */
  getBom(projectId: string): Observable<BomResponse> {
    return this.http.get<BomResponse>(`${this.base}/${projectId}/bom`);
  }

  /** Upload a BOM file (.xlsx, .xls, .csv) */
  uploadBom(projectId: string, file: File): Observable<BomResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BomResponse>(`${this.base}/${projectId}/bom`, formData);
  }



  /** Get the real-time stock verification status of the BOM components */
  getStockStatus(projectId: string): Observable<ProjectStockStatusResponse> {
    return this.http.get<ProjectStockStatusResponse>(`${this.base}/${projectId}/stock-status`);
  }

  /** Récupérer la charge de travail globale des utilisateurs (nombre de projets actifs) */
  getWorkload(): Observable<UserWorkload[]> {
    return this.http.get<UserWorkload[]>(`${this.base}/assignments/workload`);
  }

  /** Recherche d'alternatives pour les composants du BOM */
  findAlternatives(projectId: string, provider: AlternativeProvider = 'ALL', mpn?: string): Observable<AlternativeResponse[]> {
    let params = new HttpParams().set('provider', provider);
    if (mpn) {
      params = params.set('mpn', mpn);
    }
    return this.http.get<AlternativeResponse[]>(`${this.base}/${projectId}/bom/alternatives`, { params });
  }

  /** Déposer les fichiers techniques (Chef de Projet / Support) */
  uploadFichiersTechniques(projectId: string, files: File[]): Observable<Projet> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.post<Projet>(`${this.base}/${projectId}/fichiers-techniques`, formData);
  }

  /** Valider les fichiers techniques (Client) */
  validerFichiers(projectId: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/valider-fichiers`, null);
  }

  /** Abandonner le projet (Chef de Projet / Support) */
  abandonner(projectId: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/abandonner`, null);
  }

  /** Supprimer un fichier technique (PM / Admin) — envoie l'URL Cloudinary complète */
  deleteFichierTechnique(projectId: string, fileUrl: string): Observable<Projet> {
    return this.http.delete<Projet>(`${this.base}/${projectId}/fichiers-techniques`, {
      params: { fileUrl }
    });
  }

  // ═══════════════════════════════════════════════════
  // Transition Phase 1 → Phase 2 (Prototype)
  // ═══════════════════════════════════════════════════

  /** Transition in-place vers la Faisabilité */
  transitionToFaisabilite(projectId: string): Observable<Projet> {
    return this.http.post<Projet>(`${this.base}/${projectId}/transition-faisabilite`, {});
  }

  /** Transition in-place vers le Prototype (avec extraction BOM auto) */
  transitionToPrototype(projectId: string, bomFileId: string): Observable<Projet> {
    const body: TransitionRequest = { bomFileId };
    return this.http.post<Projet>(`${this.base}/${projectId}/transition-prototype`, body);
  }

  /** Téléverser des fichiers internes (Support / PM / Admin) */
  uploadFichiersInternes(projectId: string, files: File[]): Observable<Projet> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return this.http.post<Projet>(`${this.base}/${projectId}/fichiers-internes`, formData);
  }

  /** Démarrer l'analyse par le Support (passe le projet à EN_COURS_ANALYSE) */
  startAnalysis(projectId: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/start-analysis`, null);
  }

  /** Finaliser la qualification Support (passe le projet à REDACTION_CAHIER_CHARGES ou FICHIERS_TECHNIQUES) */
  finaliserQualificationSupport(projectId: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/finaliser-qualification-support`, null);
  }

  // ═══════════════════════════════════════════════════
  // Scénario 2 — Décisions BOM & Alternatives
  // ═══════════════════════════════════════════════════

  /** Décision globale sur les alternatives pour composants manquants (OUI / NON) */
  postAlternativesDecision(projectId: string, acceptAlternatives: boolean): Observable<Projet> {
    const body: AlternativesDecisionRequest = { acceptAlternatives };
    return this.http.post<Projet>(`${this.base}/${projectId}/bom/alternatives/decision`, body);
  }

  /** Enregistrement des décisions composant par composant */
  saveComponentDecisions(projectId: string, requests: BomComponentDecisionRequest[]): Observable<BomResponse> {
    return this.http.post<BomResponse>(`${this.base}/${projectId}/bom/decisions`, requests);
  }

  /** Validation finale sécurisée & idempotente de la BOM */
  validateFinalBom(projectId: string): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/bom/validate`, null);
  }

  // ═══════════════════════════════════════════════════
  // Gestion Documentaire Unifiée & Scénario 3 (Validation)
  // ═══════════════════════════════════════════════════

  /** Upload d'un document typé (BOM, GERBER, DOCUMENT_TECHNIQUE, PLAN_TEST, RAPPORT_VALIDATION, etc.) */
  uploadDocument(projectId: string, file: File, typeDocument?: TypeDocumentProjet): Observable<DocumentProjet> {
    const formData = new FormData();
    formData.append('file', file);
    if (typeDocument) {
      formData.append('typeDocument', typeDocument);
    }
    return this.http.post<DocumentProjet>(`${this.base}/${projectId}/documents`, formData);
  }

  /** Récupérer la liste des documents d'un projet */
  getDocuments(projectId: string, type?: TypeDocumentProjet): Observable<DocumentProjet[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<DocumentProjet[]>(`${this.base}/${projectId}/documents`, { params });
  }

  /** Supprimer un document d'un projet par son ID */
  deleteDocument(projectId: string, documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${projectId}/documents/${documentId}`);
  }

  /** Transition Prototype → Validation (stage initial: BOM_VALIDEE) */
  transitionToValidation(projectId: string): Observable<Projet> {
    return this.http.post<Projet>(`${this.base}/${projectId}/transition-validation`, {});
  }

  /** Modification sécurisée du stage Validation (Machine d'état) */
  updateStage(projectId: string, stage: ProjectStage): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/stage`, { stage });
  }

  /** Transition Validation → Production (stage initial: PRODUCTION_FICHIERS_RECUS) */
  transitionToProduction(projectId: string, quantiteSouhaitee?: number): Observable<Projet> {
    const body: TransitionRequest = quantiteSouhaitee ? { quantiteSouhaitee } : {};
    return this.http.post<Projet>(`${this.base}/${projectId}/transition-production`, body);
  }

  /** Modification sécurisée du stage Production (Machine d'état) */
  updateStageProduction(projectId: string, stage: ProjectStage): Observable<Projet> {
    return this.http.put<Projet>(`${this.base}/${projectId}/stage-production`, { stage });
  }

  /** Récupérer l'URL d'accès sécurisée et signée temporaire pour un document (Option 3 - Presigned URL) */
  getDocumentAccessUrl(projectId: string, documentId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/${projectId}/documents/${documentId}/access-url`);
  }

  // ═══════════════════════════════════════════════════
  // Analyse DFM / DRC des fichiers Gerber
  // ═══════════════════════════════════════════════════

  /** Récupère le résultat de l'analyse DFM du dernier fichier Gerber du projet */
  getDfmResult(projectId: string): Observable<DfmAnalysisResult> {
    return this.http.get<DfmAnalysisResult>(`${this.base}/${projectId}/gerber/dfm-result`);
  }

  /** Relance manuellement l'analyse DFM (déjà déclenchée automatiquement à l'upload) */
  triggerDfmAnalysis(projectId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${projectId}/gerber/dfm-analyze`, {});
  }

  // ═══════════════════════════════════════════════════
  // Feedback qualité — expérience projet globale
  // ═══════════════════════════════════════════════════

  /** Prochain projet livré sans avis soumis (popup global) — null si aucun */
  getPendingFeedback(): Observable<PendingFeedback | null> {
    return this.http.get<PendingFeedback | null>(`${this.base}/feedback/pending`);
  }

  /** Soumettre l'avis client une fois le projet livré (statut COMPLETED) */
  submitFeedback(projectId: string, req: ProjetFeedbackRequest): Observable<ProjetFeedback> {
    return this.http.post<ProjetFeedback>(`${this.base}/${projectId}/feedback`, req);
  }

  /** Récupérer l'avis soumis pour un projet (client propriétaire ou staff autorisé) */
  getFeedback(projectId: string): Observable<ProjetFeedback> {
    return this.http.get<ProjetFeedback>(`${this.base}/${projectId}/feedback`);
  }

  /** GET /projets/stats — indicateurs projets du tableau de bord (ADMINISTRATEUR) */
  getProjetStats(): Observable<ProjetStats> {
    return this.http.get<ProjetStats>(`${this.base}/stats`);
  }

  /**
   * Statistiques agregees des avis (ADMINISTRATEUR).
   * Calculees par MongoDB sur toute la collection : contrairement a un calcul fait
   * sur la page chargee, elles restent justes quel que soit le nombre d'avis.
   */
  getFeedbackStats(): Observable<FeedbackStats> {
    return this.http.get<FeedbackStats>(`${this.base}/feedback/stats`);
  }

  /** Liste des avis pour le staff interne (CHEF_DE_PROJET : ses projets assignés, ADMINISTRATEUR : tous) */
  listFeedback(page = 0, size = 20): Observable<Page<ProjetFeedback>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<ProjetFeedback>>(`${this.base}/feedback`, { params });
  }
}


