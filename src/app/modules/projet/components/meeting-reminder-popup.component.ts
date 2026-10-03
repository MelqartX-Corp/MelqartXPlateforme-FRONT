import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReunionService } from '../services/reunion.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Reunion } from '../models/reunion.models';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-meeting-reminder-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-reminder-popup.component.html',
  styles: [`
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-slideIn { animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }

    @keyframes bounceSubtle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    .animate-bounce-subtle { animation: bounceSubtle 3s infinite ease-in-out; }
  `]
})
export class MeetingReminderPopupComponent implements OnInit, OnDestroy {
  private reunionSvc = inject(ReunionService);
  private authSvc = inject(AuthService);

  isChefDeProjet = false;
  upcomingReunion: Reunion | null = null;
  
  isMinimized = false;
  isMuted = false;
  countdownFormatted = '';

  private pollSub?: Subscription;
  private timerSub?: Subscription;
  private updateEventSub?: Subscription;
  private hasPlayed30MinSound = false;
  private dismissedMeetingIds = new Set<string>();

  @HostListener('window:focus')
  onWindowFocus() {
    this.checkMeetings();
  }

  ngOnInit() {
    this.authSvc.currentUser$.subscribe(user => {
      // Rappel actif UNIQUEMENT pour le Chef de Projet (pas pour l'Admin)
      this.isChefDeProjet = user?.role === 'CHEF_DE_PROJET';
      if (this.isChefDeProjet) {
        this.startWatchingMeetings();
      } else {
        this.stopWatching();
        this.upcomingReunion = null;
      }
    });
  }

  ngOnDestroy() {
    this.stopWatching();
  }

  startWatchingMeetings() {
    this.checkMeetings();

    // 1. Déclenchement immédiat lors d'une mise à jour de réunion
    this.updateEventSub = this.reunionSvc.reunionUpdated$.subscribe(() => {
      this.checkMeetings();
    });

    // 2. Vérification périodique en arrière-plan (toutes les 8 secondes)
    this.pollSub = interval(8000).subscribe(() => this.checkMeetings());

    // 3. Rafraîchissement en temps réel du compte à rebours (chaque seconde)
    this.timerSub = interval(1000).subscribe(() => this.updateCountdown());
  }

  stopWatching() {
    this.pollSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.updateEventSub?.unsubscribe();
  }

  checkMeetings() {
    if (!this.isChefDeProjet) {
      this.upcomingReunion = null;
      return;
    }

    this.reunionSvc.getMyReunions().subscribe({
      next: (reunions) => {
        const now = Date.now();
        // Recherche uniquement les réunions planifiées qui commencent dans les 30 prochaines minutes
        // ET qui ne sont pas encore commencées (diffMs > 0). Dès que l'heure arrive (diffMs <= 0), la notification disparaît.
        const relevant = (reunions || [])
          .filter(r => r.statut === 'PLANIFIEE')
          .filter(r => !this.dismissedMeetingIds.has(r.id))
          .map(r => {
            const startTime = this.parseDateMs(r.dateDebut);
            const diffMs = startTime - now;
            return { reunion: r, startTime, diffMs };
          })
          .filter(item => item.diffMs <= 30 * 60 * 1000 && item.diffMs > 0)
          .sort((a, b) => a.startTime - b.startTime);

        if (relevant.length > 0) {
          const next = relevant[0];
          const isNewMeeting = !this.upcomingReunion || this.upcomingReunion.id !== next.reunion.id;
          this.upcomingReunion = next.reunion;

          if (isNewMeeting) {
            this.hasPlayed30MinSound = false;
            this.playNotificationSound('chime');
          }
          this.updateCountdown();
        } else {
          // Aucune réunion imminente avant le début -> masquer la popup
          this.upcomingReunion = null;
        }
      },
      error: () => {}
    });
  }

  private parseDateMs(dateStr: string): number {
    if (!dateStr) return 0;
    return new Date(dateStr).getTime();
  }

  updateCountdown() {
    if (!this.upcomingReunion) return;

    const now = Date.now();
    const startTime = this.parseDateMs(this.upcomingReunion.dateDebut);
    const diffMs = startTime - now;

    // Dès que l'heure de la réunion arrive (diffMs <= 0), le rappel se retire automatiquement
    if (diffMs <= 0) {
      this.upcomingReunion = null;
      return;
    }

    // Compte à rebours avant le début (< 30 min)
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    this.countdownFormatted = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')} min`;

    if (!this.hasPlayed30MinSound) {
      this.hasPlayed30MinSound = true;
      this.playNotificationSound('chime');
    }
  }

  joinMeeting() {
    if (this.upcomingReunion?.lienVisio) {
      window.open(this.upcomingReunion.lienVisio, '_blank');
    }
  }

  minimize() {
    this.isMinimized = true;
  }

  maximize() {
    this.isMinimized = false;
  }

  dismiss() {
    if (this.upcomingReunion) {
      this.dismissedMeetingIds.add(this.upcomingReunion.id);
      this.upcomingReunion = null;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.playNotificationSound('chime');
    }
  }

  private playNotificationSound(type: 'chime' | 'start') {
    if (this.isMuted) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    } catch {}
  }
}
