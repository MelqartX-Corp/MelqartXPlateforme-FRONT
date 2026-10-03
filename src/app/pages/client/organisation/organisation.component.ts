import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, InvitationService, ProfileService } from '../../../services';
import { User, InvitationResponse, InviteCollaboratorRequest } from '../../../models';

@Component({
  selector: 'app-client-organisation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organisation.component.html'
})
export class ClientOrganisationComponent implements OnInit {
  private authService = inject(AuthService);
  private invitationService = inject(InvitationService);
  private profileService = inject(ProfileService);

  userRole = '';
  currentUserId = '';
  orgName = '';
  orgMatricule = '';

  // Team data (merged view)
  members: User[] = [];
  invitations: InvitationResponse[] = [];
  loading = true;

  // Invite modal
  showInviteModal = false;
  inviteForm: InviteCollaboratorRequest = { email: '', nom: '', prenom: '' };
  inviteError = '';
  inviting = false;

  // Cancel invitation modal
  showCancelModal = false;
  invitationToCancel: InvitationResponse | null = null;

  // Remove member modal
  showRemoveModal = false;
  memberToRemove: User | null = null;

  // Toast feedback (replaces ugly browser alert)
  toast: { message: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any = null;

  ngOnInit() {
    this.userRole = this.authService.role || '';
    this.currentUserId = localStorage.getItem('userId') || '';

    this.profileService.getProfile().subscribe({
      next: (user) => {
        this.currentUserId = user.id;
        if (user.organisation) {
          this.orgName = user.organisation.raisonSociale;
          this.orgMatricule = user.organisation.matriculeFiscale;
        }
      }
    });

    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.loadCount = 0;
    this.invitationService.getMyOrgMembers().subscribe({
      next: (data) => { this.members = data; this.checkLoaded(); },
      error: () => this.checkLoaded()
    });
    this.invitationService.getMyOrgInvitations().subscribe({
      next: (data) => { this.invitations = data; this.checkLoaded(); },
      error: () => this.checkLoaded()
    });
  }

  private loadCount = 0;
  private checkLoaded() { if (++this.loadCount >= 2) this.loading = false; }

  get isOwner() { return this.userRole === 'CLIENT_ENTREPRISE'; }

  get pendingInvitations() { return this.invitations.filter(i => i.status === 'PENDING'); }

  get engineers() { return this.members.filter(m => m.role === 'INGENIEUR'); }

  isCurrentUser(member: User) { return member.id === this.currentUserId; }

  // ── Toast helper ──
  private showToast(message: string, type: 'success' | 'error') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => this.toast = null, 4000);
  }

  // ── Invite Modal ──
  openInviteModal() {
    this.inviteForm = { email: '', nom: '', prenom: '' };
    this.inviteError = '';
    this.showInviteModal = true;
  }
  closeInviteModal() { this.showInviteModal = false; }

  sendInvitation() {
    this.inviteError = '';
    this.inviting = true;
    this.invitationService.invite(this.inviteForm).subscribe({
      next: () => {
        this.inviting = false;
        this.closeInviteModal();
        this.showToast('Invitation envoyée avec succès.', 'success');
        this.loadAll();
      },
      error: (err) => {
        this.inviting = false;
        this.inviteError = err.error?.message || "Erreur lors de l'envoi.";
      }
    });
  }

  // ── Cancel Invitation Modal ──
  openCancelModal(inv: InvitationResponse) { this.invitationToCancel = inv; this.showCancelModal = true; }
  closeCancelModal() { this.invitationToCancel = null; this.showCancelModal = false; }

  confirmCancel() {
    if (!this.invitationToCancel) return;
    this.invitationService.cancel(this.invitationToCancel.id).subscribe({
      next: () => {
        this.closeCancelModal();
        this.showToast('Invitation annulée.', 'success');
        this.loadAll();
      },
      error: (err) => {
        this.closeCancelModal();
        this.showToast(err.error?.message || 'Erreur lors de l\'annulation.', 'error');
        this.loadAll(); // Refresh anyway to sync state
      }
    });
  }

  resendInvitation(id: string) {
    this.invitationService.resend(id).subscribe({
      next: () => {
        this.showToast('Invitation renvoyée.', 'success');
        this.loadAll();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Impossible de renvoyer l\'invitation.', 'error');
        // Always reload — invitation may have been accepted/cancelled
        this.loadAll();
      }
    });
  }

  // ── Remove Member Modal ──
  openRemoveModal(member: User) { this.memberToRemove = member; this.showRemoveModal = true; }
  closeRemoveModal() { this.memberToRemove = null; this.showRemoveModal = false; }

  confirmRemove() {
    if (!this.memberToRemove) return;
    this.invitationService.removeMember(this.memberToRemove.id).subscribe({
      next: () => {
        this.closeRemoveModal();
        this.showToast('Collaborateur retiré de l\'organisation.', 'success');
        this.loadAll();
      },
      error: (err) => {
        this.closeRemoveModal();
        this.showToast(err.error?.message || 'Erreur lors de la suppression.', 'error');
      }
    });
  }
}
