import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { BlockedUserService } from '../../../services';

interface BlockedUser {
  userId: string;
  email: string;
  nom: string;
  prenom: string;
  role?: string;
  blockedUntil: string;
  otpAttempts: number;
}

@Component({
  selector: 'app-admin-blocked-users',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './blocked-users.component.html'
})
export class BlockedUsersComponent implements OnInit {
  private adminService = inject(BlockedUserService);

  blockedUsers: BlockedUser[] = [];
  loading = true;
  error = '';
  unblockingEmail: string | null = null;

  // Confirm modal state
  showConfirmModal = false;
  userToUnblock: BlockedUser | null = null;

  // Category filter
  userCategory: 'internal' | 'external' = 'internal';
  private INTERNAL_ROLES = ['ADMINISTRATEUR', 'SUPPORT_TECHNIQUE', 'CHEF_DE_PROJET', 'APPRO'];

  get filteredBlockedUsers(): BlockedUser[] {
    if (this.userCategory === 'internal') {
      return this.blockedUsers.filter(u => u.role && this.INTERNAL_ROLES.includes(u.role));
    }
    return this.blockedUsers.filter(u => !u.role || !this.INTERNAL_ROLES.includes(u.role));
  }

  ngOnInit() {
    this.loadBlockedUsers();
  }

  loadBlockedUsers() {
    this.loading = true;
    this.error = '';
    this.adminService.getBlockedUsers().subscribe({
      next: (data: any[]) => {
        this.blockedUsers = data;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = "Impossible de charger les utilisateurs bloqués.";
        this.loading = false;
      }
    });
  }

  confirmUnblock(user: BlockedUser) {
    this.userToUnblock = user;
    this.showConfirmModal = true;
  }

  cancelUnblock() {
    this.userToUnblock = null;
    this.showConfirmModal = false;
  }

  unblockUser() {
    if (!this.userToUnblock) return;
    const email = this.userToUnblock.email;

    this.unblockingEmail = email;
    this.showConfirmModal = false;
    this.adminService.unblockUser(email).subscribe({
      next: () => {
        this.unblockingEmail = null;
        this.userToUnblock = null;
        this.blockedUsers = this.blockedUsers.filter(u => u.email !== email);
      },
      error: (err: any) => {
        this.unblockingEmail = null;
        this.userToUnblock = null;
        this.error = "Erreur lors du déblocage : " + (err.error?.message || 'Erreur inconnue');
      }
    });
  }
}
