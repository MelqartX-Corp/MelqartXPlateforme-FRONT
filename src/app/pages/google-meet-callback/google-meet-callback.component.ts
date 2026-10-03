import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReunionService } from '../../modules/projet/services/reunion.service';

@Component({
  selector: 'app-google-meet-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-meet-callback.component.html',
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  `]
})
export class GoogleMeetCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reunionSvc = inject(ReunionService);

  loading = true;
  success = false;
  error = false;
  errorMessage = '';
  connectedEmail = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        this.loading = false;
        this.error = true;
        this.errorMessage = "Autorisation refusée par Google (" + error + ").";
        return;
      }

      if (!code) {
        this.loading = false;
        this.error = true;
        this.errorMessage = "Code d'autorisation introuvable dans la réponse Google.";
        return;
      }

      this.reunionSvc.handleGoogleCallback(code, state).subscribe({
        next: (res) => {
          this.loading = false;
          this.success = true;
          this.connectedEmail = res?.googleEmail || '';
          setTimeout(() => {
            this.router.navigate(['/validator/calendar']);
          }, 2000);
        },
        error: (err) => {
          this.loading = false;
          this.error = true;
          this.errorMessage = err?.error?.error || "Une erreur est survenue lors de l'échange de token.";
        }
      });
    });
  }

  retournerAuDashboard() {
    this.router.navigate(['/validator/calendar']);
  }
}