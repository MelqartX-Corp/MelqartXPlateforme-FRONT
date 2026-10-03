import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/**
 * État de l'écran d'initialisation de l'application (app-loading).
 *
 * Cet écran est rendu à la racine (app.component) tandis que le router-outlet
 * a déjà monté la page dessous : tout élément en position fixe avec un z-index
 * élevé se dessine donc PAR-DESSUS le splash. Ce service permet à ces éléments
 * — le popup de sollicitation d'avis, par exemple — d'attendre que l'écran
 * d'initialisation ait disparu avant de s'afficher.
 */
@Injectable({ providedIn: 'root' })
export class AppLoadingService {
  private readonly pretSubject = new BehaviorSubject<boolean>(false);

  /** Émet true une fois l'écran d'initialisation retiré */
  readonly pret$: Observable<boolean> = this.pretSubject.asObservable();

  get estPret(): boolean {
    return this.pretSubject.value;
  }

  /** Appelé par le composant d'initialisation quand il se retire */
  marquerPret(): void {
    this.pretSubject.next(true);
  }

  /** Émet une seule fois, dès que l'application est prête (immédiatement si elle l'est déjà) */
  quandPret(): Observable<boolean> {
    return this.pret$.pipe(filter(Boolean), take(1));
  }
}
