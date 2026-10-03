import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services';

@Component({
  selector: 'app-dashboard-router',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-router.component.html'
})
export class DashboardRouterComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  ngOnInit() {
    const role = this.authService.role;

    setTimeout(() => {
      if (role === 'ADMINISTRATEUR') {
        this.router.navigate(['/admin/dashboard']);
      } else if (role === 'SUPPORT_TECHNIQUE') {
        this.router.navigate(['/support/dashboard']);
      } else if (role === 'CHEF_DE_PROJET') {
        this.router.navigate(['/validator/dashboard']);
      } else if (role === 'APPRO') {
        this.router.navigate(['/appro/dashboard']);
      } else if (role === 'INGENIEUR') {
        this.router.navigate(['/client/dashboard']);
      } else if (role === 'TECHNICIEN') {
        this.router.navigate(['/technicien/dashboard']);
      } else {
        this.router.navigate(['/client/dashboard']);
      }
    }, 100);
  }
}
