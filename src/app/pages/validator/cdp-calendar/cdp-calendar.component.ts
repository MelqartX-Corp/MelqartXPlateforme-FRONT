import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ReunionService } from '../../../modules/projet/services/reunion.service';
import { Reunion, DisponibiliteChefProjet, JourDisponibilite } from '../../../modules/projet/models/reunion.models';
import { ChefAvailabilityModalComponent } from '../../../modules/projet/components/chef-availability-modal.component';

interface CalendarDay {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWorkingDay: boolean;
  meetings: Reunion[];
}

@Component({
  selector: 'app-cdp-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChefAvailabilityModalComponent],
  templateUrl: './cdp-calendar.component.html'
})
export class CdpCalendarComponent implements OnInit, OnDestroy {
  private reunionSvc = inject(ReunionService);
  private pollSub?: Subscription;
  private eventSub?: Subscription;

  loading = true;
  showAvailabilityModal = false;
  reunions: Reunion[] = [];
  disponibilite?: DisponibiliteChefProjet;
  googleConnected = false;

  // View state
  activeView: 'MONTH' | 'WEEK' | 'LIST' = 'MONTH';

  // Month navigation
  currentDate = new Date();
  calendarDays: CalendarDay[] = [];
  selectedDay: CalendarDay | null = null;

  // List view search & filter
  listSearchTerm = '';
  listStatusFilter = 'ALL';

  // Copy feedback
  copiedMeetingId: string | null = null;

  // Cancel state
  meetingToCancel: Reunion | null = null;
  cancelReason = '';
  cancelling = false;

  dayLabels: { [key: string]: string } = {
    MONDAY: 'Lundi',
    TUESDAY: 'Mardi',
    WEDNESDAY: 'Mercredi',
    THURSDAY: 'Jeudi',
    FRIDAY: 'Vendredi',
    SATURDAY: 'Samedi',
    SUNDAY: 'Dimanche'
  };

  ngOnInit() {
    this.loadAllData();

    // Instant sync when meetings are booked or updated
    this.eventSub = this.reunionSvc.reunionUpdated$.subscribe(() => {
      this.loadReunions();
    });

    // Background poll every 5s
    this.pollSub = interval(5000).subscribe(() => {
      if (!this.loading && !this.cancelling) {
        this.reunionSvc.getMyReunions().subscribe({
          next: (data) => {
            this.reunions = data || [];
            this.generateCalendarDays();
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.pollSub) this.pollSub.unsubscribe();
    if (this.eventSub) this.eventSub.unsubscribe();
  }

  loadAllData() {
    this.loading = true;
    this.reunionSvc.getMyDisponibilites().subscribe({
      next: (dispo) => {
        this.disponibilite = dispo;
        this.googleConnected = !!dispo?.googleCalendarConnected;
        this.loadReunions();
      },
      error: () => {
        this.loadReunions();
      }
    });
  }

  loadReunions() {
    this.reunionSvc.getMyReunions().subscribe({
      next: (data) => {
        this.reunions = data || [];
        this.generateCalendarDays();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onAvailabilityModalClose() {
    this.showAvailabilityModal = false;
    this.loadAllData();
  }

  // ─── Dynamic Real-time Status Resolution ───
  getEffectiveStatus(r: Reunion): string {
    if (r.statut === 'ANNULEE') return 'ANNULEE';
    if (r.statut === 'REPORTEE') return 'REPORTEE';
    
    if (r.dateDebut && r.dateFin) {
      const now = new Date().getTime();
      const start = new Date(r.dateDebut).getTime();
      const end = new Date(r.dateFin).getTime();
      
      if (now > end) {
        return 'TERMINEE';
      }
      if (now >= start && now <= end) {
        return 'EN_COURS';
      }
    }
    return 'PLANIFIEE';
  }

  // ─── Metric Computations ───
  get upcomingMeetingsCount(): number {
    return this.reunions.filter(r => {
      const st = this.getEffectiveStatus(r);
      return st === 'PLANIFIEE' || st === 'EN_COURS';
    }).length;
  }

  get completedMeetingsCount(): number {
    return this.reunions.filter(r => this.getEffectiveStatus(r) === 'TERMINEE').length;
  }

  get todayMeetings(): Reunion[] {
    const todayStr = new Date().toISOString().slice(0, 10);
    return this.reunions.filter(r => r.dateDebut?.startsWith(todayStr) && this.getEffectiveStatus(r) !== 'ANNULEE');
  }

  get todayMeetingsCount(): number {
    return this.todayMeetings.length;
  }

  get nextMeetingToday(): Reunion | null {
    return this.todayMeetings[0] || null;
  }

  get nextMeetingTodayLabel(): string {
    if (!this.nextMeetingToday) return "Aucun rendez-vous restant aujourd'hui";
    const time = this.nextMeetingToday.dateDebut ? new Date(this.nextMeetingToday.dateDebut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const proj = this.nextMeetingToday.projetNom || this.nextMeetingToday.titre || 'Projet';
    return `Prochaine : ${time} (${proj})`;
  }

  get totalConsultationHours(): number {
    const totalMinutes = this.reunions
      .filter(r => this.getEffectiveStatus(r) !== 'ANNULEE')
      .reduce((sum, r) => {
        if (r.dateDebut && r.dateFin) {
          const diff = (new Date(r.dateFin).getTime() - new Date(r.dateDebut).getTime()) / (1000 * 60);
          return sum + (diff > 0 ? diff : (this.disponibilite?.dureeCreneauMinutes || 30));
        }
        return sum + (this.disponibilite?.dureeCreneauMinutes || 30);
      }, 0);
    return totalMinutes / 60;
  }

  get completedPercentage(): number {
    if (this.reunions.length === 0) return 0;
    return (this.completedMeetingsCount / this.reunions.length) * 100;
  }

  get upcomingPercentage(): number {
    if (this.reunions.length === 0) return 0;
    return (this.upcomingMeetingsCount / this.reunions.length) * 100;
  }

  get todayDateFormatted(): string {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  get currentMonthName(): string {
    return this.currentDate.toLocaleDateString('fr-FR', { month: 'long' });
  }

  get currentYear(): number {
    return this.currentDate.getFullYear();
  }

  get joursDisponibilites(): JourDisponibilite[] {
    return this.disponibilite?.jours || [];
  }

  get selectedDayWorkingPlages() {
    if (!this.selectedDay) return [];
    const dayOfWeek = this.selectedDay.date.getDay(); // 0 = Sunday, 1 = Monday
    const mapDay: { [key: number]: string } = {
      1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY'
    };
    const jName = mapDay[dayOfWeek];
    const jConfig = this.disponibilite?.jours?.find(j => j.jour === jName);
    return jConfig && jConfig.actif ? jConfig.plages : [];
  }

  // ─── Month Navigation & Calendar Generation ───
  previousMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendarDays();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendarDays();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendarDays();
  }

  generateCalendarDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Calculate starting offset (Monday = 0)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDay[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Days from previous month to fill grid
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const dateStr = this.formatDate(d);
      days.push({
        date: d,
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWorkingDay: this.checkIsWorkingDay(d),
        meetings: this.getMeetingsForDate(dateStr)
      });
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = this.formatDate(d);
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWorkingDay: this.checkIsWorkingDay(d),
        meetings: this.getMeetingsForDate(dateStr)
      });
    }

    // Days of next month to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = this.formatDate(d);
      days.push({
        date: d,
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWorkingDay: this.checkIsWorkingDay(d),
        meetings: this.getMeetingsForDate(dateStr)
      });
    }

    this.calendarDays = days;

    // Auto-select today or first day
    if (!this.selectedDay) {
      const todayCell = days.find(d => d.isToday && d.isCurrentMonth);
      this.selectedDay = todayCell || days.find(d => d.isCurrentMonth) || null;
    } else {
      // Re-sync selectedDay with new data
      const updated = days.find(d => d.dateStr === this.selectedDay?.dateStr);
      if (updated) this.selectedDay = updated;
    }
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private checkIsWorkingDay(d: Date): boolean {
    const dayOfWeek = d.getDay();
    const mapDay: { [key: number]: string } = {
      1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY'
    };
    const jName = mapDay[dayOfWeek];
    const jConfig = this.disponibilite?.jours?.find(j => j.jour === jName);
    return jConfig ? jConfig.actif : (dayOfWeek !== 0 && dayOfWeek !== 6);
  }

  private getMeetingsForDate(dateStr: string): Reunion[] {
    return this.reunions.filter(r => r.dateDebut?.startsWith(dateStr));
  }

  selectDay(day: CalendarDay) {
    this.selectedDay = day;
  }

  // ─── Filtered List View ───
  get filteredListReunions(): Reunion[] {
    return this.reunions
      .filter(r => {
        const effStatus = this.getEffectiveStatus(r);
        if (this.listStatusFilter === 'PLANIFIEE' && (effStatus !== 'PLANIFIEE' && effStatus !== 'EN_COURS')) {
          return false;
        }
        if (this.listStatusFilter === 'TERMINEE' && effStatus !== 'TERMINEE') {
          return false;
        }
        if (this.listStatusFilter === 'ANNULEE' && effStatus !== 'ANNULEE') {
          return false;
        }
        if (this.listSearchTerm.trim()) {
          const term = this.listSearchTerm.toLowerCase().trim();
          const matchProj = r.projetNom?.toLowerCase().includes(term);
          const matchClient = r.clientNom?.toLowerCase().includes(term) || r.clientEmail?.toLowerCase().includes(term);
          const matchTitle = r.titre?.toLowerCase().includes(term);
          if (!matchProj && !matchClient && !matchTitle) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.dateDebut || '').getTime() - new Date(a.dateDebut || '').getTime());
  }

  copyLink(url: string, id: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      this.copiedMeetingId = id;
      setTimeout(() => {
        if (this.copiedMeetingId === id) this.copiedMeetingId = null;
      }, 2000);
    }
  }

  openCancelModal(r: Reunion) {
    this.meetingToCancel = r;
    this.cancelReason = '';
  }

  confirmCancelMeeting() {
    if (!this.meetingToCancel || !this.cancelReason.trim()) return;
    this.cancelling = true;
    this.reunionSvc.annulerReunion(this.meetingToCancel.id, { motif: this.cancelReason }).subscribe({
      next: () => {
        this.cancelling = false;
        this.meetingToCancel = null;
        this.loadReunions();
      },
      error: (err) => {
        this.cancelling = false;
        alert("Erreur lors de l'annulation : " + (err.error?.message || "Erreur"));
      }
    });
  }
}
