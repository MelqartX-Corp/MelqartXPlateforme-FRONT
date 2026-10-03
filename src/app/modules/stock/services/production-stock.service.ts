import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IssueReelsRequest,
  KittingLine,
  ProductionActionResult,
  ProjectTraceability,
  ReturnReelsRequest,
  StockMovement,
  ThtIssueRequest
} from '../models/stock.models';

/**
 * Le passage du stock a l'atelier.
 *
 * Sous /reservations et non /projets : c'est la reservation qui relie un
 * projet a ses bobines, et la passerelle route deja ce prefixe vers ms-stock.
 */
@Injectable({ providedIn: 'root' })
export class ProductionStockService {
  private http = inject(HttpClient);
  private base = `${environment.services.gateway}${environment.apiVersion}/reservations`;

  /**
   * Liste de preparation d'un projet : quelles bobines, combien prendre sur
   * chacune, ou elles sont, et lesquelles sont retenues ailleurs.
   */
  kittingList(projetId: string): Observable<KittingLine[]> {
    return this.http.get<KittingLine[]>(`${this.base}/project/${projetId}/reels`);
  }

  /** Les bobines quittent le magasin pour les machines. Rien n'est decompte. */
  issue(projetId: string, body: IssueReelsRequest): Observable<ProductionActionResult> {
    return this.http.post<ProductionActionResult>(
      `${this.base}/project/${projetId}/issue`, body);
  }

  /**
   * Production terminee : les bobines reviennent en stock production et le
   * stock baisse enfin. C'est le seul geste qui fait baisser le stock.
   */
  returnToProdStock(projetId: string, body: ReturnReelsRequest): Observable<ProductionActionResult> {
    return this.http.post<ProductionActionResult>(
      `${this.base}/project/${projetId}/return`, body);
  }

  /** Traversant : la sortie est la consommation, il n'y a pas de retour. */
  issueTht(projetId: string, body: ThtIssueRequest): Observable<ProductionActionResult> {
    return this.http.post<ProductionActionResult>(
      `${this.base}/project/${projetId}/issue-tht`, body);
  }

  /** Origine des composants montes sur les cartes du projet. */
  traceability(projetId: string): Observable<ProjectTraceability> {
    return this.http.get<ProjectTraceability>(`${this.base}/project/${projetId}/traceability`);
  }

  /** Toutes les bobines actuellement sur une machine, tous projets confondus. */
  inMachine(): Observable<KittingLine[]> {
    return this.http.get<KittingLine[]>(`${this.base}/in-machine`);
  }

  /** Historique d'une bobine : ce qu'elle a servi, quand, pour qui. */
  movements(reelId: string): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.base}/reels/${reelId}/movements`);
  }
}
