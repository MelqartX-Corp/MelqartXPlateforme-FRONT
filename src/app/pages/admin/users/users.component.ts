import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminUserService, BlockedUserService } from '../../../services';
import { User, CreateInternalUserRequest, UpdateProfileRequest, PaginatedResponse, DeviceResponse, OvertimeRequest, OvertimeResponse } from '../../../models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html'
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminUserService);
  private route = inject(ActivatedRoute);
  private blockedService = inject(BlockedUserService);

  showModal = false;
  users: User[] = [];
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  loading = true;
  error = '';

  // Tabs
  activeTab: 'active' | 'archived' = 'active';

  /**
   * Internes ou externes — porté par la route, pas par un onglet.
   *
   * Ce sont deux populations qu'on ne compare pas : les collaborateurs d'un
   * côté, les clients de l'autre. Les mêler derrière un bouton faisait qu'on
   * ne savait plus, en arrivant sur l'écran, lesquels on avait sous les yeux.
   * Chacune a maintenant son entrée de menu et son adresse.
   */
  userCategory: 'internal' | 'external' = 'internal';

  get isExternal(): boolean {
    return this.userCategory === 'external';
  }

  get pageTitle(): string {
    return this.isExternal ? 'Utilisateurs externes' : 'Utilisateurs internes';
  }

  get pageSubtitle(): string {
    return this.isExternal
      ? 'Comptes clients et entreprises : organisations, statuts de vérification et accès'
      : 'Collaborateurs MelqartX : rôles, statuts de vérification et autorisations';
  }

  // Search
  searchEmail = '';

  // Create modal — correspond à CreateInternalUserRequest backend
  // Champs : nom, prenom, email, telephone, role
  newUser: CreateInternalUserRequest = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    role: 'SUPPORT_TECHNIQUE'
  };
  createError = '';
  creating = false;

  onDigitOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) { event.preventDefault(); }
  }

  // ── Edit modal ──────────────────────────────────────────
  // Backend UpdateProfileRequest : nom, prenom, telephone, adresse
  // PAS d'email / PAS de role
  showEditModal = false;
  editUser: UpdateProfileRequest & { _id: string; _displayName: string } = {
    _id: '',
    _displayName: '',
    nom: '',
    prenom: '',
    telephone: '',
    adresse: ''
  };
  editError = '';
  updating = false;

  // ── Confirm Deactivate/Archive modal ────────────────────
  showConfirmModal = false;
  userToDeactivate: User | null = null;

  // ── Confirm Reactivate modal ────────────────────────────
  showReactivateModal = false;
  userToReactivate: User | null = null;

  // ── Detail modal (getUserById) ──────────────────────────
  showDetailModal = false;
  detailUser: User | null = null;
  loadingDetail = false;

  // Security detail state
  isUserBlocked = false;
  blockDetails: any = null;
  processingSecurityAction = false;

  // Devices
  devices: DeviceResponse[] = [];
  loadingDevices = false;
  revokingIp: string | null = null;

  // Overtime
  overtimeHistory: OvertimeResponse[] = [];
  loadingOvertime = false;
  grantingOvertime = false;
  overtimeError = '';
  overtimeForm: OvertimeRequest = { dateDebut: '', dateFin: '', heureDebut: '19:00', heureFin: '23:00' };

  private INTERNAL_ROLES = ['ADMINISTRATEUR', 'SUPPORT_TECHNIQUE', 'CHEF_DE_PROJET', 'APPRO', 'TECHNICIEN'];

  get isInternalUser(): boolean {
    if (!this.detailUser) return false;
    return this.INTERNAL_ROLES.includes(this.detailUser.role);
  }

  ngOnInit() {
    this.userCategory = this.route.snapshot.data['userCategory'] === 'external'
      ? 'external'
      : 'internal';
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.error = '';
    const isActive = this.activeTab === 'active';

    let source$;
    if (this.userCategory === 'internal') {
      source$ = this.adminService.getInternalUsers(this.currentPage, this.pageSize, isActive);
    } else {
      source$ = this.adminService.getExternalUsers(this.currentPage, this.pageSize, isActive);
    }

    source$.subscribe({
      next: (res: PaginatedResponse<User>) => {
        this.users = res.content;
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors du chargement des utilisateurs.';
      }
    });
  }

  switchTab(tab: 'active' | 'archived') {
    this.activeTab = tab;
    this.currentPage = 0;
    this.searchEmail = '';
    this.loadUsers();
  }

  // Backend GET /admin/users/search?email=... retourne UN SEUL UserResponse (pas un array)
  searchUsers() {
    if (!this.searchEmail.trim()) {
      this.loadUsers();
      return;
    }
    this.loading = true;
    this.error = '';
    this.adminService.searchByEmail(this.searchEmail).subscribe({
      next: (user) => {
        this.users = [user];
        this.totalElements = 1;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.users = [];
        this.totalElements = 0;
        if (err.status === 404) {
          this.error = 'Aucun utilisateur trouvé avec cet email.';
        } else {
          this.error = err.error?.message || 'Erreur lors de la recherche.';
        }
      }
    });
  }

  nextPage() {
    this.currentPage++;
    this.loadUsers();
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadUsers();
    }
  }

  // ── Create ──────────────────────────────────────────────
  openModal() { this.showModal = true; this.createError = ''; }
  closeModal() { this.showModal = false; }

  createUser() {
    this.createError = '';
    this.creating = true;
    this.adminService.createInternalUser(this.newUser).subscribe({
      next: () => {
        this.creating = false;
        this.closeModal();
        this.newUser = { nom: '', prenom: '', email: '', telephone: '', adresse: '', role: 'SUPPORT_TECHNIQUE' };
        this.loadUsers();
      },
      error: (err) => {
        this.creating = false;
        this.createError = err.error?.message || 'Erreur lors de la création.';
      }
    });
  }

  // ── Edit (UpdateProfileRequest: nom, prenom, telephone, adresse) ──
  openEditModal(user: User) {
    this.editUser = {
      _id: user.id,
      _displayName: `${user.prenom} ${user.nom}`,
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone,
      adresse: user.adresse ?? ''
    };
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal() { this.showEditModal = false; }

  saveUser() {
    this.editError = '';
    this.updating = true;
    const { _id, _displayName, ...payload } = this.editUser;
    this.adminService.updateUser(_id, payload).subscribe({
      next: () => {
        this.updating = false;
        this.closeEditModal();
        this.loadUsers();
      },
      error: (err) => {
        this.updating = false;
        this.editError = err.error?.message || 'Erreur lors de la mise à jour.';
      }
    });
  }

  // ── Soft Delete / Archive (avec popup confirmation) ────
  confirmDeactivate(user: User) {
    this.userToDeactivate = user;
    this.showConfirmModal = true;
  }

  cancelDeactivate() {
    this.userToDeactivate = null;
    this.showConfirmModal = false;
  }

  deactivateUser() {
    if (!this.userToDeactivate) return;
    this.adminService.deactivateUser(this.userToDeactivate.id).subscribe({
      next: () => {
        this.cancelDeactivate();
        this.loadUsers();
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la désactivation.';
        this.cancelDeactivate();
      }
    });
  }

  // ── Reactivate (avec popup confirmation) ───────────────
  confirmReactivate(user: User) {
    this.userToReactivate = user;
    this.showReactivateModal = true;
  }

  cancelReactivate() {
    this.userToReactivate = null;
    this.showReactivateModal = false;
  }

  reactivateUser() {
    if (!this.userToReactivate) return;
    this.adminService.reactivateUser(this.userToReactivate.id).subscribe({
      next: () => {
        this.cancelReactivate();
        this.loadUsers();
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la réactivation.';
        this.cancelReactivate();
      }
    });
  }

  // ── Toast notification ─────────────────────────────────
  toast: { message: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any = null;

  private showToast(message: string, type: 'success' | 'error') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => this.toast = null, 4000);
  }

  resendingSetupUserId: string | null = null;

  resendSetupLink(userId: string) {
    this.resendingSetupUserId = userId;
    this.adminService.resendSetupLink(userId).subscribe({
      next: (res) => {
        this.resendingSetupUserId = null;
        this.showToast(res.message || 'Lien de configuration renvoyé avec succès.', 'success');
      },
      error: (err) => {
        this.resendingSetupUserId = null;
        this.showToast(err.error?.message || 'Erreur lors du renvoi du lien.', 'error');
      }
    });
  }

  // ── Detail (getUserById) ───────────────────────────────
  openDetail(userId: string) {
    this.loadingDetail = true;
    this.showDetailModal = true;
    this.detailUser = null;
    this.adminService.getUserById(userId).subscribe({
      next: (user) => {
        this.detailUser = user;
        this.loadingDetail = false;
        
        // Fetch block status asynchronously
        this.isUserBlocked = false;
        this.blockDetails = null;
        this.blockedService.isBlocked(user.email).subscribe({
          next: (res: any) => {
             this.isUserBlocked = res.blocked;
             this.blockDetails = res.details || null;
          }
        });

        // Load devices
        this.loadDevices(user.id);

        // Load overtime history for internal users
        if (this.isInternalUser) {
          this.loadOvertimeHistory(user.id);
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        this.error = err.error?.message || 'Erreur lors du chargement du détail.';
        this.showDetailModal = false;
      }
    });
  }

  closeDetail() {
    this.showDetailModal = false;
    this.detailUser = null;
    this.isUserBlocked = false;
    this.blockDetails = null;
    this.devices = [];
    this.overtimeHistory = [];
    this.overtimeError = '';
  }
  
  // ── Security Actions ─────────────────────────────────────
  
  forceLogoutUser() {
    if (!this.detailUser) return;
    if (!confirm(`Forcer la déconnexion de toutes les sessions de ${this.detailUser.prenom} ?`)) return;
    
    this.processingSecurityAction = true;
    this.adminService.forceLogoutUser(this.detailUser.id).subscribe({
      next: () => {
        this.processingSecurityAction = false;
        alert("Toutes les sessions de cet utilisateur ont été fermées et invalidées.");
      },
      error: (err) => {
        this.processingSecurityAction = false;
        alert("Erreur: " + (err.error?.message || "Impossible de forcer la déconnexion"));
      }
    });
  }
  
  unblockDetailUser() {
    if (!this.detailUser || !this.isUserBlocked) return;
    
    this.processingSecurityAction = true;
    this.blockedService.unblockUser(this.detailUser.email).subscribe({
      next: () => {
        this.processingSecurityAction = false;
        this.isUserBlocked = false;
        this.blockDetails = null;
        alert("L'utilisateur a été débloqué avec succès.");
      },
      error: (err) => {
        this.processingSecurityAction = false;
        alert("Erreur: " + (err.error?.message || "Impossible de débloquer l'utilisateur"));
      }
    });
  }

  // ── Device Management ─────────────────────────────────────

  loadDevices(userId: string) {
    this.loadingDevices = true;
    this.devices = [];
    this.adminService.getUserDevices(userId).subscribe({
      next: (data) => { this.devices = data; this.loadingDevices = false; },
      error: () => this.loadingDevices = false
    });
  }

  revokeDevice(device: DeviceResponse) {
    if (!this.detailUser) return;
    const did = device.deviceId || device.ipAddress;
    if (!confirm(`Révoquer l'appareil "${device.deviceName}" ?`)) return;
    this.revokingIp = did;
    this.adminService.revokeDevice(this.detailUser.id, did).subscribe({
      next: () => {
        this.revokingIp = null;
        this.devices = this.devices.filter(d => (d.deviceId || d.ipAddress) !== did);
      },
      error: (err) => {
        this.revokingIp = null;
        alert('Erreur: ' + (err.error?.message || 'Impossible de révoquer.'));
      }
    });
  }

  // ── Overtime Management ───────────────────────────────────

  loadOvertimeHistory(userId: string) {
    this.loadingOvertime = true;
    this.overtimeHistory = [];
    this.adminService.getOvertimeHistory(userId).subscribe({
      next: (data) => { this.overtimeHistory = data; this.loadingOvertime = false; },
      error: () => this.loadingOvertime = false
    });
  }

  grantOvertime() {
    if (!this.detailUser) return;
    this.overtimeError = '';
    if (!this.overtimeForm.dateDebut || !this.overtimeForm.dateFin) {
      this.overtimeError = 'Veuillez renseigner les dates.';
      return;
    }
    this.grantingOvertime = true;
    this.adminService.grantOvertime(this.detailUser.id, this.overtimeForm).subscribe({
      next: (res) => {
        this.grantingOvertime = false;
        this.overtimeHistory.unshift(res);
        this.overtimeForm = { dateDebut: '', dateFin: '', heureDebut: '19:00', heureFin: '23:00' };
        alert(`Accès overtime accordé ! Code: ${res.accessCode}`);
      },
      error: (err) => {
        this.grantingOvertime = false;
        this.overtimeError = err.error?.message || 'Erreur lors de l\'attribution.';
      }
    });
  }

  getCountryFlag(country: string | null): string {
    if (!country || country.length !== 2) return '🌍';
    const codePoints = country.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
}
