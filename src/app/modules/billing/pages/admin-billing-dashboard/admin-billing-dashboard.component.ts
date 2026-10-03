import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { BillingDashboard } from '../../models/billing.models';

@Component({
  selector: 'app-admin-billing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-billing-dashboard.component.html'
})
export class AdminBillingDashboardComponent implements OnInit {
  private billingSvc = inject(BillingService);

  loading = true;
  error = '';
  data?: BillingDashboard;

  ngOnInit() {
    this.billingSvc.getGlobalDashboard().subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger le dashboard financier';
        this.loading = false;
      }
    });
  }
}
