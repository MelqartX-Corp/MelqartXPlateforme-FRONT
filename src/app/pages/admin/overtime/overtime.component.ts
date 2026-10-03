import { Component, OnInit, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminUserService } from '../../../services';
import { User, OvertimeRequest, OvertimeResponse } from '../../../models';

interface SelectableUser {
  user: User;
  selected: boolean;
}

@Component({
  selector: 'app-admin-overtime',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './overtime.component.html'
})
export class AdminOvertimeComponent implements OnInit {
  private adminService = inject(AdminUserService);
  private elRef = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const dropdown = this.elRef.nativeElement.querySelector('#userDropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      this.showDropdown = false;
    }
  }

  // Users
  internalUsers: SelectableUser[] = [];
  loadingUsers = true;
  showDropdown = false;
  searchTerm = '';

  // Form
  form: OvertimeRequest = {
    dateDebut: '',
    dateFin: '',
    heureDebut: '19:00',
    heureFin: '23:00'
  };

  // State
  showConfirmModal = false;
  submitting = false;
  formError = '';
  results: { userName: string; success: boolean; code?: string; error?: string }[] = [];
  showResults = false;

  // History
  history: (OvertimeResponse & { _userName?: string })[] = [];
  loadingHistory = false;

  get selectedUsers(): SelectableUser[] {
    return this.internalUsers.filter(u => u.selected);
  }

  get filteredUsers(): SelectableUser[] {
    if (!this.searchTerm.trim()) return this.internalUsers;
    const q = this.searchTerm.toLowerCase();
    return this.internalUsers.filter(u =>
      `${u.user.prenom} ${u.user.nom}`.toLowerCase().includes(q) ||
      u.user.email.toLowerCase().includes(q)
    );
  }

  ngOnInit() {
    this.loadInternalUsers();
    this.loadActiveAccesses(); // indépendant du chargement des users
  }

  loadInternalUsers() {
    this.loadingUsers = true;
    this.adminService.getInternalUsers(0, 200).subscribe({
      next: (res: any) => {
        this.internalUsers = res.content
          .filter((u: any) => u.role === 'SUPPORT_TECHNIQUE' || u.role === 'CHEF_DE_PROJET' || u.role === 'APPRO' || u.role === 'TECHNICIEN')
          .map((u: any) => ({ user: u, selected: false }));
        this.loadingUsers = false;
      },
      error: () => this.loadingUsers = false
    });
  }

  toggleUser(su: SelectableUser) {
    su.selected = !su.selected;
  }

  removeUser(su: SelectableUser) {
    su.selected = false;
  }

  selectAll() {
    this.filteredUsers.forEach(u => u.selected = true);
  }

  deselectAll() {
    this.internalUsers.forEach(u => u.selected = false);
  }

  openConfirmModal() {
    this.formError = '';
    this.results = [];
    this.showResults = false;

    if (this.selectedUsers.length === 0) {
      this.formError = 'Veuillez sélectionner au moins un utilisateur.';
      return;
    }
    if (!this.form.dateDebut || !this.form.dateFin) {
      this.formError = 'Veuillez renseigner les dates.';
      return;
    }
    if (!this.form.heureDebut || !this.form.heureFin) {
      this.formError = 'Veuillez renseigner les heures.';
      return;
    }

    this.showConfirmModal = true;
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
  }

  confirmSubmit() {
    this.showConfirmModal = false;
    this.submitting = true;

    const calls = this.selectedUsers.map(su =>
      this.adminService.grantOvertime(su.user.id, { ...this.form })
    );

    forkJoin(calls).subscribe({
      next: (responses) => {
        this.submitting = false;
        this.results = responses.map((res, i) => ({
          userName: `${this.selectedUsers[i].user.prenom} ${this.selectedUsers[i].user.nom}`,
          success: true,
          code: res.accessCode
        }));
        this.showResults = true;
        // Deselect all after success
        this.deselectAll();
        // Refresh active accesses after a submisssion
        this.loadActiveAccesses();
      },
      error: (err) => {
        this.submitting = false;
        this.formError = err.error?.message || 'Erreur lors de l\'attribution.';
      }
    });
  }

  closeResults() {
    this.showResults = false;
    this.results = [];
  }

  getRoleBadge(role: string): string {
    const map: Record<string, string> = {
      'SUPPORT_TECHNIQUE': 'Support',
      'APPRO': 'Appro',
      'CHEF_DE_PROJET': 'Chef de projet',
      'TECHNICIEN': 'Technicien',
      'ADMINISTRATEUR': 'Admin',
      'INGENIEUR': 'Ingénieur'
    };
    return map[role] || role;
  }

  getRoleBadgeColor(role: string): string {
    const map: Record<string, string> = {
      'SUPPORT_TECHNIQUE': 'hsl(var(--primary))',
      'APPRO': 'hsl(var(--destructive))',
      'CHEF_DE_PROJET': 'hsl(var(--warning))',
      'TECHNICIEN': 'hsl(142, 71%, 45%)',
      'ADMINISTRATEUR': 'hsl(var(--destructive))',
      'INGENIEUR': 'hsl(var(--info))'
    };
    return map[role] || 'hsl(var(--muted-foreground))';
  }

  // Active accesses
  activeAccesses: OvertimeResponse[] = [];
  loadingAccesses = false;

  loadActiveAccesses() {
    this.loadingAccesses = true;
    this.activeAccesses = [];

    // 1 seule requête HTTP au lieu de N (une par user)
    this.adminService.getActiveOvertimes().subscribe({
      next: (data) => {
        this.activeAccesses = data;
        this.loadingAccesses = false;
      },
      error: () => this.loadingAccesses = false
    });
  }
}
