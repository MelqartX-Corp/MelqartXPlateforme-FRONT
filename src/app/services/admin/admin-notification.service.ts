// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NOTIFICATION SERVICE (ms-notification via API Gateway)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationResponse } from '../../models/admin/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
  private http = inject(HttpClient);
  private base = environment.services.gateway + '/api/notifications';
  private projetBase = environment.services.gateway + '/api/v1/projets';
  private adminBase = environment.services.gateway + '/api/v1/admin';

  private notificationsSubject = new BehaviorSubject<NotificationResponse[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

    /** Catégorise un type de notification */
  public getCategory(type: string): 'PROJET' | 'BILLING' | 'STOCK' | 'TICKET' | 'SECURITY' | 'OTHER' {
    if (!type) return 'OTHER';
    const t = type.toUpperCase();
    if (t.includes('PROJET') || t.includes('BOM') || t.includes('STAGE') || t.includes('REPORT') || t.includes('CAHIER') || t.includes('TECH_DOCS') || t.includes('QUALIFICATION')) return 'PROJET';
    if (t.includes('BILLING') || t.includes('QUOTE') || t.includes('INVOICE') || t.includes('TRANCHE') || t.includes('PAYMENT') || t.includes('CONTRACT')) return 'BILLING';
    if (t.includes('STOCK')) return 'STOCK';
    if (t.includes('TICKET')) return 'TICKET';
    if (t.includes('DEVICE') || t.includes('SECURITY') || t.includes('HOURS') || t.includes('OVERTIME') || t.includes('LOGOUT') || t.includes('BLOCKED') || t.includes('INVITATION') || t.includes('WELCOME')) return 'SECURITY';
    return 'OTHER';
  }

  /** GET /api/notifications â€” toutes les notifications pour l'utilisateur connecté */
  getNotifications(): Observable<NotificationResponse[]> {
    return this.http.get<NotificationResponse[]>(this.base).pipe(
      tap(notifs => {
        const sorted = (notifs || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.notificationsSubject.next(sorted);
        const unread = sorted.filter(n => !(n.read || n.isRead)).length;
        this.unreadCountSubject.next(unread);
      })
    );
  }

  /** GET /api/notifications/unread-count */
  getUnreadCount(): Observable<number> {
    return this.http.get<any>(this.base + '/unread-count').pipe(
      map(res => typeof res === 'number' ? res : (res?.count ?? 0)),
      tap(count => this.unreadCountSubject.next(count))
    );
  }

  /** PUT /api/notifications/{id}/read */
  markAsRead(id: string): Observable<void> {
    return this.http.put<void>(this.base + '/' + id + '/read', null).pipe(
      tap(() => {
        const current = this.notificationsSubject.getValue().map(n =>
          n.id === id ? { ...n, read: true, isRead: true } : n
        );
        this.notificationsSubject.next(current);
        const unread = current.filter(n => !(n.read || n.isRead)).length;
        this.unreadCountSubject.next(unread);
      })
    );
  }

  /** PUT /api/notifications/read-all */
  markAllRead(): Observable<void> {
    return this.http.put<void>(this.base + '/read-all', null).pipe(
      tap(() => {
        const current = this.notificationsSubject.getValue().map(n => ({ ...n, read: true, isRead: true }));
        this.notificationsSubject.next(current);
        this.unreadCountSubject.next(0);
      })
    );
  }

  // â”€â”€ QUICK ACTIONS HELPERS â”€â”€

  /** Décision alternatives BOM (Client) */
  decideBomAlternatives(projectId: string, accept: boolean): Observable<any> {
    return this.http.post(this.projetBase + '/' + projectId + '/bom/alternatives/decision', {
      acceptAlternatives: accept
    });
  }

  /** Bloquer un compte suspect (Admin) */
  blockUser(userId: string): Observable<any> {
    return this.http.put(this.adminBase + '/users/' + userId + '/block', null);
  }
}