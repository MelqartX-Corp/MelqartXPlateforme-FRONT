import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Le jeu d'icônes des tableaux de bord.
 *
 * Un seul composant plutôt qu'un `<svg>` recopié à chaque emploi : les
 * gabarits en contenaient des centaines de lignes, et une icône corrigée à
 * un endroit restait fausse aux dix autres.
 *
 * Tracés à 24×24, contour uniquement, épaisseur 2 : ils héritent donc de la
 * couleur du texte environnant et suivent le thème sans réglage.
 */
@Component({
  selector: 'app-dash-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="taille" [attr.height]="taille" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" [attr.stroke-width]="epaisseur"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
      <ng-container [ngSwitch]="nom">

        <g *ngSwitchCase="'users'">
          <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.85" />
        </g>
        <g *ngSwitchCase="'user-plus'">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" />
        </g>
        <g *ngSwitchCase="'package'">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        </g>
        <g *ngSwitchCase="'file-text'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </g>
        <g *ngSwitchCase="'file'">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </g>
        <g *ngSwitchCase="'headphones'">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </g>
        <g *ngSwitchCase="'dollar'">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </g>
        <g *ngSwitchCase="'building'">
          <rect x="3" y="3" width="13" height="18" rx="1" /><path d="M16 8h5l1 14H16" />
          <line x1="7" y1="7" x2="10" y2="7" /><line x1="7" y1="11" x2="10" y2="11" />
          <line x1="7" y1="15" x2="10" y2="15" />
        </g>
        <g *ngSwitchCase="'trending'">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
        </g>
        <g *ngSwitchCase="'trending-down'">
          <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />
        </g>
        <g *ngSwitchCase="'clock'">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </g>
        <g *ngSwitchCase="'truck'">
          <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 6v3h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
        </g>
        <g *ngSwitchCase="'alert'">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </g>
        <g *ngSwitchCase="'alert-triangle'">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </g>
        <g *ngSwitchCase="'check'">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 11.5 14.5 15 10" />
        </g>
        <g *ngSwitchCase="'check-simple'"><polyline points="20 6 9 17 4 12" /></g>
        <g *ngSwitchCase="'kanban'">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </g>
        <g *ngSwitchCase="'calendar'">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </g>
        <g *ngSwitchCase="'layers'">
          <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </g>
        <g *ngSwitchCase="'shield'">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </g>
        <g *ngSwitchCase="'activity'"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></g>
        <g *ngSwitchCase="'inbox'">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </g>
        <g *ngSwitchCase="'star'">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </g>
        <g *ngSwitchCase="'zap'"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></g>
        <g *ngSwitchCase="'target'">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
        </g>
        <g *ngSwitchCase="'message'">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </g>
        <g *ngSwitchCase="'wifi'">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
        </g>
        <g *ngSwitchCase="'cpu'">
          <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
        </g>
        <g *ngSwitchCase="'refresh'">
          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </g>
        <g *ngSwitchCase="'download'">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </g>
        <g *ngSwitchCase="'plus-circle'">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </g>
        <g *ngSwitchCase="'arrow-right'">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </g>
        <g *ngSwitchCase="'hourglass'">
          <path d="M6 2h12M6 22h12M6 2c0 5 6 5 6 10s-6 5-6 10M18 2c0 5-6 5-6 10s6 5 6 10" />
        </g>
        <g *ngSwitchCase="'briefcase'">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </g>

        <!-- Repli : un cercle plutôt qu'un trou. Une icône inconnue doit se
             voir en revue, pas disparaître silencieusement en production. -->
        <circle *ngSwitchDefault cx="12" cy="12" r="9" />
      </ng-container>
    </svg>
  `,
  styles: [`:host { display: inline-flex; line-height: 0; }`],
})
export class DashIconComponent {
  @Input({ required: true }) nom!: string;
  @Input() taille = 16;
  @Input() epaisseur = 2;
}
