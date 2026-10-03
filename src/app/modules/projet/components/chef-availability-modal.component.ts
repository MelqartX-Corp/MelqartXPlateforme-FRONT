import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionService } from '../services/reunion.service';
import { DisponibiliteChefProjet, DisponibiliteRequest, JourDisponibilite } from '../models/reunion.models';

@Component({
  selector: 'app-chef-availability-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chef-availability-modal.component.html'
})
export class ChefAvailabilityModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private reunionSvc = inject(ReunionService);

  loading = true;
  saving = false;
  successMessage = '';
  errorMessage = '';

  // Google OAuth2 State
  googleConnected = false;
  googleEmail = '';
  connectingGoogle = false;
  disconnectingGoogle = false;

  dureeCreneau = 30;
  tempsTampon = 0;
  fuseauHoraire = 'Africa/Tunis';

  dayLabels: { [key: string]: string } = {
    MONDAY: 'Lundi',
    TUESDAY: 'Mardi',
    WEDNESDAY: 'Mercredi',
    THURSDAY: 'Jeudi',
    FRIDAY: 'Vendredi',
    SATURDAY: 'Samedi',
    SUNDAY: 'Dimanche'
  };

  joursConfig: JourDisponibilite[] = [];

  ngOnInit() {
    this.loadDisponibilites();
  }

  loadDisponibilites() {
    this.loading = true;
    this.reunionSvc.getMyDisponibilites().subscribe({
      next: (dispo) => {
        this.dureeCreneau = dispo.dureeCreneauMinutes || 30;
        this.tempsTampon = dispo.tempsTamponMinutes || 0;
        this.fuseauHoraire = dispo.fuseauHoraire || 'Africa/Tunis';
        this.googleConnected = !!dispo.googleCalendarConnected;
        this.googleEmail = dispo.googleEmail || '';
        this.normalizeJours(dispo.jours);
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Erreur lors du chargement des disponibilités.';
        this.loading = false;
      }
    });
  }

  connecterGoogle() {
    this.connectingGoogle = true;
    this.errorMessage = '';
    this.reunionSvc.getGoogleAuthUrl().subscribe({
      next: (res) => {
        if (res?.authUrl) {
          window.location.href = res.authUrl;
        }
      },
      error: (err) => {
        this.connectingGoogle = false;
        this.errorMessage = err?.error?.error || "Impossible d'initialiser la connexion Google.";
      }
    });
  }

  deconnecterGoogle() {
    this.disconnectingGoogle = true;
    this.reunionSvc.disconnectGoogle().subscribe({
      next: () => {
        this.disconnectingGoogle = false;
        this.googleConnected = false;
        this.googleEmail = '';
        this.successMessage = 'Compte Google déconnecté avec succès.';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.disconnectingGoogle = false;
        this.errorMessage = err?.error?.error || 'Erreur lors de la déconnexion.';
      }
    });
  }

  normalizeJours(jours?: JourDisponibilite[]) {
    const defaultDays: Array<'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'> = [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
    ];

    this.joursConfig = defaultDays.map(day => {
      const existing = jours?.find(j => j.jour === day);
      if (existing) {
        const p = existing.plages && existing.plages.length > 0 ? [...existing.plages] : [];
        while (p.length < 2) {
          p.push({ heureDebut: '14:00', heureFin: '19:00' });
        }
        return {
          jour: day,
          actif: existing.actif,
          plages: p
        };
      } else {
        const isOuvre = day !== 'SATURDAY' && day !== 'SUNDAY';
        return {
          jour: day,
          actif: isOuvre,
          plages: [
            { heureDebut: '09:00', heureFin: '12:00' },
            { heureDebut: '14:00', heureFin: '19:00' }
          ]
        };
      }
    });
  }

  applyMondayToWeekdays() {
    const monday = this.joursConfig.find(j => j.jour === 'MONDAY');
    if (!monday) return;
    const weekdays: Array<'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'> = ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    this.joursConfig.forEach(j => {
      if (weekdays.includes(j.jour as any)) {
        j.actif = monday.actif;
        j.plages = [
          { heureDebut: monday.plages[0].heureDebut, heureFin: monday.plages[0].heureFin },
          { heureDebut: monday.plages[1].heureDebut, heureFin: monday.plages[1].heureFin }
        ];
      }
    });
    this.successMessage = 'Horaires du Lundi appliqués à tous les jours ouvrés (Lun - Ven).';
    setTimeout(() => this.successMessage = '', 3000);
  }

  saveDisponibilites() {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const req: DisponibiliteRequest = {
      dureeCreneauMinutes: this.dureeCreneau,
      tempsTamponMinutes: this.tempsTampon,
      fuseauHoraire: this.fuseauHoraire,
      jours: this.joursConfig
    };

    this.reunionSvc.updateMyDisponibilites(req).subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = 'Disponibilités sauvegardées avec succès !';
        setTimeout(() => {
          this.successMessage = '';
          this.close.emit();
        }, 1200);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  onBackdropClick(e: MouseEvent) {
    this.close.emit();
  }
}