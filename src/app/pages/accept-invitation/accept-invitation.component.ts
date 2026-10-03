import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvitationService } from '../../services';
import { ValidateInvitationResponse } from '../../models';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accept-invitation.component.html'
})
export class AcceptInvitationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invitationService = inject(InvitationService);

  loading = true;
  invitation: ValidateInvitationResponse | null = null;
  accepted = false;

  password = '';
  confirmPassword = '';
  showPwd = false;
  submitting = false;
  error = '';

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading = false;
      this.invitation = { valid: false, message: "Aucun token d'invitation fourni.", email: '', nom: '', prenom: '', organisationName: '', inviterName: '' };
      return;
    }

    this.invitationService.validate(token).subscribe({
      next: (res) => {
        this.invitation = res;
        this.loading = false;
      },
      error: () => {
        this.invitation = { valid: false, message: 'Erreur lors de la vérification.', email: '', nom: '', prenom: '', organisationName: '', inviterName: '' };
        this.loading = false;
      }
    });
  }

  onSubmit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    this.error = '';
    this.submitting = true;

    this.invitationService.accept({ token, motDePasse: this.password }).subscribe({
      next: () => {
        this.submitting = false;
        this.accepted = true;
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || "Erreur lors de l'acceptation de l'invitation.";
      }
    });
  }
}
