import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjetService } from '../services/projet.service';
import { AuthService } from '../../../services/auth/auth.service';
import { AppLoadingService } from '../../../services/ui/app-loading.service';
import { PendingFeedback, ProjetFeedbackRequest } from '../models/projet.models';
import { Subscription, interval } from 'rxjs';

/** Clés de notation attendues par le backend (ProjetFeedbackRequest) */
export type CritereKey = 'noteSupport' | 'noteCommunication' | 'noteProduit';

export interface CritereNotation {
  key: CritereKey;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-feedback-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-prompt-modal.component.html',
  styleUrls: ['./feedback-prompt-modal.component.scss']
})
export class FeedbackPromptModalComponent implements OnInit, OnDestroy {
  private projetSvc = inject(ProjetService);
  private authSvc = inject(AuthService);
  private appLoading = inject(AppLoadingService);

  isClient = false;
  visible = false;
  pending: PendingFeedback | null = null;
  submitting = false;
  submitted = false;
  error = '';

  /**
   * Un axe de notation par colonne réellement stockée côté backend.
   * Le backend valide chacune des trois notes (@NotNull @Min(1) @Max(5)) :
   * les noter séparément permet enfin de distinguer, par exemple, un support
   * excellent d'un produit décevant.
   */
  criteres: CritereNotation[] = [
    { key: 'noteSupport', label: 'Support', icon: '🎧' },
    { key: 'noteCommunication', label: 'Communication', icon: '💬' },
    { key: 'noteProduit', label: 'Produit', icon: '📦' }
  ];

  ratingLabels: Record<number, string> = {
    1: 'Très décevante',
    2: 'Décevante',
    3: 'Moyenne',
    4: 'Bonne',
    5: 'Excellente'
  };

  /** Étoile survolée : { clé de l'axe, valeur } */
  hovered: { key: CritereKey; value: number } | null = null;

  form: ProjetFeedbackRequest = { noteSupport: 0, noteCommunication: 0, noteProduit: 0, commentaire: '' };

  private pollSub?: Subscription;
  private affichageSub?: Subscription;
  private dismissedProjectIds = new Set<string>();

  ngOnInit() {
    this.authSvc.currentUser$.subscribe(user => {
      this.isClient = user?.role === 'CLIENT' || user?.role === 'CLIENT_ENTREPRISE';
      if (this.isClient) {
        this.check();
        if (!this.pollSub) {
          this.pollSub = interval(5 * 60 * 1000).subscribe(() => this.check());
        }
      } else {
        this.pollSub?.unsubscribe();
        this.pollSub = undefined;
        this.visible = false;
      }
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.affichageSub?.unsubscribe();
  }

  check() {
    this.projetSvc.getPendingFeedback().subscribe({
      next: (p) => {
        if (p && !this.dismissedProjectIds.has(p.projetId)) {
          this.pending = p;
          this.resetForm();
          // Ce popup est en position fixe avec un z-index élevé : affiché trop
          // tôt, il se dessine par-dessus l'écran d'initialisation de
          // l'application. On attend donc que celui-ci soit retiré.
          this.affichageSub?.unsubscribe();
          this.affichageSub = this.appLoading.quandPret().subscribe(() => {
            if (this.pending) this.visible = true;
          });
        } else if (!p) {
          this.visible = false;
          this.pending = null;
        }
      },
      error: () => {}
    });
  }

  resetForm() {
    this.form = { noteSupport: 0, noteCommunication: 0, noteProduit: 0, commentaire: '' };
    this.hovered = null;
    this.submitted = false;
    this.error = '';
  }

  onStarHover(key: CritereKey, value: number) {
    this.hovered = { key, value };
  }

  onStarLeave() {
    this.hovered = null;
  }

  /**
   * Premier clic : les trois axes prennent la même note, pour que donner un
   * avis reste l'affaire d'un seul clic. Les clics suivants n'affectent que
   * l'axe visé, ce qui permet d'affiner.
   */
  setRating(key: CritereKey, value: number) {
    if (this.notedCount === 0) {
      this.form.noteSupport = value;
      this.form.noteCommunication = value;
      this.form.noteProduit = value;
    } else {
      this.form[key] = value;
    }
    this.error = '';
  }

  /** Note affichée pour un axe : le survol l'emporte sur la valeur choisie */
  activeRating(key: CritereKey): number {
    if (this.hovered && this.hovered.key === key) return this.hovered.value;
    return this.form[key];
  }

  /** Libellé de l'axe survolé/noté, affiché à droite de ses étoiles */
  ratingLabel(key: CritereKey): string {
    return this.ratingLabels[this.activeRating(key)] || '';
  }

  get notedCount(): number {
    return this.criteres.filter(c => this.form[c.key] >= 1).length;
  }

  get allRated(): boolean {
    return this.notedCount === this.criteres.length;
  }

  dismiss() {
    if (this.pending) {
      this.dismissedProjectIds.add(this.pending.projetId);
    }
    this.visible = false;
    // Sans cela, un popup refermé pendant l'initialisation réapparaîtrait après
    this.affichageSub?.unsubscribe();
  }

  submit() {
    if (!this.pending || this.submitting) return;

    // Le backend exige les trois notes entre 1 et 5
    if (!this.allRated) {
      this.error = 'Veuillez noter les trois aspects avant d\'envoyer votre avis.';
      return;
    }

    const payload: ProjetFeedbackRequest = {
      noteSupport: this.form.noteSupport,
      noteCommunication: this.form.noteCommunication,
      noteProduit: this.form.noteProduit,
      commentaire: (this.form.commentaire || '').trim()
    };

    this.submitting = true;
    this.error = '';
    this.projetSvc.submitFeedback(this.pending.projetId, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        setTimeout(() => {
          this.visible = false;
          this.pending = null;
          this.submitted = false;
        }, 2200);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l\'envoi de votre avis';
        this.submitting = false;
      }
    });
  }
}
