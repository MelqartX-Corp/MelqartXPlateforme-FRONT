import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { StatsResponse } from '../../models/ticket.models';

@Component({
  selector: 'app-ticket-stats',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ticket-stats.component.html',
})
export class TicketStatsComponent implements OnInit {
  private ticketSvc = inject(TicketService);

  loading = true;
  error = '';
  stats: StatsResponse | null = null;

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading = true;
    this.error = '';

    this.ticketSvc.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors de la récupération des statistiques';
        this.loading = false;
      }
    });
  }

  // Calculer le dashoffset pour le cercle SVG de progression
  getStrokeDashoffset(percentage: number): number {
    const circumference = 2 * Math.PI * 45; // rayon r=45
    return circumference - (percentage / 100) * circumference;
  }
}
