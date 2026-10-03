// ═══════════════════════════════════════════════════════════════════════
// BASE COMMUNE — mesure du conteneur
//
// Les graphiques sont dessinés en pixels réels plutôt qu'étirés depuis un
// viewBox fixe. C'est un peu plus de code, mais les libellés gardent leur
// taille quelle que soit la largeur de la carte : un viewBox mis à l'échelle
// donne des textes minuscules sur une colonne étroite et énormes en pleine
// largeur.
// ═══════════════════════════════════════════════════════════════════════

import {
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  AfterViewInit,
  inject,
  signal,
} from '@angular/core';

@Directive()
export abstract class ChartBase implements AfterViewInit, OnDestroy {
  protected readonly hote = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  /**
   * Largeur mesurée du conteneur. La valeur de départ n'est pas nulle : un
   * graphique rendu avant la première mesure — dans un onglet caché, par
   * exemple — dessinerait des coordonnées infinies.
   */
  readonly largeur = signal(640);

  private observateur?: ResizeObserver;

  ngAfterViewInit(): void {
    const cible = this.hote.nativeElement;

    // Hors zone Angular : un redimensionnement de fenêtre déclenche des
    // dizaines de notifications, et chacune relancerait sinon une détection
    // de changements complète.
    this.zone.runOutsideAngular(() => {
      this.observateur = new ResizeObserver((entrees) => {
        const w = Math.round(entrees[0].contentRect.width);
        if (w > 0 && w !== this.largeur()) {
          this.zone.run(() => this.largeur.set(w));
        }
      });
      this.observateur.observe(cible);
    });
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
  }
}
