import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminOrgService } from '../../../services';
import { Organisation } from '../../../models';

@Component({
  selector: 'app-organisations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './organisations.component.html'
})
export class OrganisationsComponent implements OnInit {
  private adminService = inject(AdminOrgService);

  organisations: Organisation[] = [];
  loading = true;
  error = '';

  ngOnInit() {
    this.adminService.getOrganisations().subscribe({
      next: (orgs) => {
        this.organisations = orgs;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors du chargement des organisations.';
      }
    });
  }
}
