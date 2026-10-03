import { Component, EventEmitter, Input, OnInit, OnDestroy, AfterViewInit, Output, inject, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionService } from '../services/reunion.service';
import { CreneauDisponible, Reunion, ReunionRequest } from '../models/reunion.models';

interface CalendarDay {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  hasSlots: boolean;
}

@Component({
  selector: 'app-meeting-scheduler-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meeting-scheduler-modal.component.html',
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn { animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  `]
})
export class MeetingSchedulerModalComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input({ required: true }) projetId!: string;
  @Input() projetNom?: string;
  @Input() chefProjetId?: string;
  @Input() chefProjetNom?: string;
  @Output() close = new EventEmitter<void>();
  @Output() reunionCreated = new EventEmitter<Reunion>();

  private reunionSvc = inject(ReunionService);
  private elRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();

  monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  calendarDays: CalendarDay[] = [];
  allAvailableSlots: CreneauDisponible[] = [];

  selectedDateStr = '';
  selectedDayLabel = '';
  daySlots: CreneauDisponible[] = [];
  selectedSlot?: CreneauDisponible;

  titreReunion = '';
  ordreDuJour = '';

  loadingSlots = false;
  reserving = false;
  bookingSuccess = false;
  bookedReunion?: Reunion;
  errorMessage = '';
  /** Faux quand le chef de projet n'a pas connecté Google Agenda : aucun lien Meet ne peut être créé. */
  visioDisponible = true;

  ngOnInit() {
    this.titreReunion = `Point technique - ${this.projetNom || 'Projet PCB'}`;
    this.generateCalendar();
    this.loadSlots();
    this.verifierVisio();
  }

  verifierVisio() {
    this.reunionSvc.getVisioDisponible(this.projetId).subscribe({
      next: (res) => this.visioDisponible = res?.visioDisponible !== false,
      // En cas d'erreur de lecture, la réservation reste possible : le serveur refusera
      // lui-même si le lien Meet ne peut pas être créé.
      error: () => this.visioDisponible = true
    });
  }

  ngAfterViewInit() {
    try {
      this.renderer.appendChild(document.body, this.elRef.nativeElement);
    } catch (e) {
      console.warn('Could not append modal to body', e);
    }
  }

  ngOnDestroy() {
    try {
      if (this.elRef.nativeElement.parentNode === document.body) {
        this.renderer.removeChild(document.body, this.elRef.nativeElement);
      }
    } catch (e) {
      console.warn('Could not remove modal from body', e);
    }
  }

  generateCalendar() {
    const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const lastDayOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

    let startDay = firstDayOfMonth.getDay() - 1; // 0 = Lundi, 6 = Dimanche
    if (startDay === -1) startDay = 6;

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Days from previous month
    const prevMonthLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(this.currentYear, this.currentMonth - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dateStr: this.formatDateStr(d),
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        isPast: true,
        hasSlots: false
      });
    }

    // Days from current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(this.currentYear, this.currentMonth, i);
      const isPast = d < today;
      const isToday = d.getTime() === today.getTime();
      const dateStr = this.formatDateStr(d);

      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday,
        isPast,
        hasSlots: false
      });
    }

    // Days from next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(this.currentYear, this.currentMonth + 1, i);
      days.push({
        date: d,
        dateStr: this.formatDateStr(d),
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        isPast: true,
        hasSlots: false
      });
    }

    this.calendarDays = days;
    this.updateCalendarSlotsIndicator();
  }

  loadSlots() {
    this.loadingSlots = true;
    const start = new Date(this.currentYear, this.currentMonth, 1);
    const end = new Date(this.currentYear, this.currentMonth + 1, 0);

    this.reunionSvc.getCreneauxDisponibles(this.projetId, this.formatDateStr(start), this.formatDateStr(end))
      .subscribe({
        next: (slots) => {
          this.allAvailableSlots = slots || [];
          this.updateCalendarSlotsIndicator();
          this.loadingSlots = false;

          if (!this.selectedDateStr) {
            const todayStr = this.formatDateStr(new Date());
            const firstAvailable = this.calendarDays.find(d => d.isCurrentMonth && !d.isPast && d.hasSlots);
            if (firstAvailable) {
              this.selectDay(firstAvailable);
            } else {
              const todayDay = this.calendarDays.find(d => d.dateStr === todayStr && d.isCurrentMonth);
              if (todayDay) this.selectDay(todayDay);
            }
          }
        },
        error: (err) => {
          this.loadingSlots = false;
          this.errorMessage = err?.error?.message || 'Erreur lors du chargement des créneaux.';
        }
      });
  }

  updateCalendarSlotsIndicator() {
    this.calendarDays.forEach(d => {
      d.hasSlots = this.allAvailableSlots.some(s => s.date === d.dateStr && s.disponible);
    });
  }

  selectDay(d: CalendarDay) {
    if (d.isPast || !d.isCurrentMonth) return;
    this.selectedDateStr = d.dateStr;
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    this.selectedDayLabel = d.date.toLocaleDateString('fr-FR', options);
    this.daySlots = this.allAvailableSlots.filter(s => s.date === d.dateStr);
    this.selectedSlot = undefined;
  }

  isSelectedDay(d: CalendarDay): boolean {
    return this.selectedDateStr === d.dateStr;
  }

  getSlotClass(s: CreneauDisponible): string {
    if (this.selectedSlot?.debut === s.debut) {
      return 'bg-blue-600 text-white border-blue-600 shadow-md';
    }
    if (s.disponible) {
      return 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs';
    }
    return 'opacity-30 line-through pointer-events-none border-slate-200 dark:border-slate-800';
  }

  selectSlot(s: CreneauDisponible) {
    if (!s.disponible) return;
    this.selectedSlot = s;
  }

  previousMonth() {
    if (this.isCurrentMonthOrPast()) return;
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
    this.loadSlots();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
    this.loadSlots();
  }

  isCurrentMonthOrPast(): boolean {
    const today = new Date();
    return this.currentYear < today.getFullYear() ||
      (this.currentYear === today.getFullYear() && this.currentMonth <= today.getMonth());
  }

  formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  reserver() {
    if (!this.selectedSlot) return;
    this.reserving = true;
    this.errorMessage = '';

    const req: ReunionRequest = {
      dateDebut: this.selectedSlot.debut,
      titre: this.titreReunion?.trim() || `Point technique - ${this.projetNom || 'Projet PCB'}`,
      ordreDuJour: this.ordreDuJour?.trim()
    };

    this.reunionSvc.reserverReunion(this.projetId, req).subscribe({
      next: (reunion) => {
        this.reserving = false;
        this.bookingSuccess = true;
        this.bookedReunion = reunion;
        this.reunionCreated.emit(reunion);
      },
      error: (err) => {
        this.reserving = false;
        this.errorMessage = err?.error?.message || 'Erreur lors de la réservation de la réunion.';
      }
    });
  }

  onBackdropClick(e: MouseEvent) {
    this.close.emit();
  }
}