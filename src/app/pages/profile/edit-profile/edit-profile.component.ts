import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProfileService, AvatarService, LogoService, AuthService } from '../../../services';
import { environment } from '../../../../environments/environment';
import { MapPickerComponent, MapLocation } from '../../../components/map-picker/map-picker.component';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MapPickerComponent],
  templateUrl: './edit-profile.component.html'
})
export class EditProfileComponent implements OnInit {
  private profileService = inject(ProfileService);
  private avatarService = inject(AvatarService);
  private logoService = inject(LogoService);
  private authService = inject(AuthService);

  apiUrl = environment.services.gateway;
  readonly googleMapsKey = environment.googleMapsApiKey;

  // ── Profile data aligned with backend ──────────────────
  profile = {
    prenom: '',
    nom: '',
    email: '',           // read-only (not in UpdateProfileRequest)
    telephone: '',
    adresse: '',
    latitude: null as number | null,
    longitude: null as number | null,
    role: '',
    avatar: '',
    profileImage: null as string | null,
    authProvider: 'LOCAL' as 'LOCAL' | 'GOOGLE',
    // Organisation (CLIENT_ENTREPRISE only)
    isEntreprise: false,
    raisonSociale: '',
    matriculeFiscale: '',
    organisationLogo: null as string | null
  };

  saved = false;
  saving = false;
  error = '';
  showMapModal = false;
  showAvailabilityModal = false;
  isChefDeProjet = false;

  avatarThemes = [
    { gradient: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)', label: 'Bleu Océan' },
    { gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)', label: 'Violet Luxe' },
    { gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', label: 'Émeraude' },
    { gradient: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)', label: 'Ambre Solaire' },
    { gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', label: 'Rubis' },
    { gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)', label: 'Obsidienne' },
  ];
  selectedGradient = 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)';

  selectTheme(themeGradient: string) {
    this.selectedGradient = themeGradient;
    if (this.profile.email) {
      localStorage.setItem('melqart_avatar_theme_' + this.profile.email, themeGradient);
    }
    localStorage.setItem('melqart_avatar_theme_default', themeGradient);
    window.dispatchEvent(new Event('melqart_avatar_theme_changed'));
  }

  isExternalUser(): boolean {
    const r = this.authService.role || this.profile.role;
    return r === 'CLIENT' || r === 'CLIENT_ENTREPRISE' || r === 'INGENIEUR';
  }

  getRoleFormatted(): string {
    const r = this.profile.role || this.authService.role;
    switch (r) {
      case 'ADMINISTRATEUR': return 'Administrateur Système';
      case 'CHEF_DE_PROJET': return 'Chef de Projet';
      case 'SUPPORT_TECHNIQUE': return 'Support Technique';
      case 'APPRO': return 'Responsable Appro';
      case 'CLIENT_ENTREPRISE': return 'Client Entreprise (B2B)';
      case 'CLIENT': return 'Client Particulier';
      case 'INGENIEUR': return 'Ingénieur R&D';
      default: return r || 'Utilisateur';
    }
  }

  getRoleBadgeColor(): { bg: string, text: string, border: string } {
    const r = this.profile.role || this.authService.role;
    switch (r) {
      case 'ADMINISTRATEUR':
        return { bg: 'hsl(var(--destructive)/0.12)', text: 'hsl(var(--destructive))', border: 'hsl(var(--destructive)/0.3)' };
      case 'CHEF_DE_PROJET':
        return { bg: 'hsl(var(--primary)/0.12)', text: 'hsl(var(--primary))', border: 'hsl(var(--primary)/0.3)' };
      case 'SUPPORT_TECHNIQUE':
        return { bg: 'hsl(var(--accent)/0.12)', text: 'hsl(var(--accent))', border: 'hsl(var(--accent)/0.3)' };
      case 'APPRO':
        return { bg: 'hsl(var(--warning)/0.12)', text: 'hsl(var(--warning))', border: 'hsl(var(--warning)/0.3)' };
      case 'CLIENT_ENTREPRISE':
        return { bg: 'hsl(217 91% 60%/0.15)', text: 'hsl(217 91% 60%)', border: 'hsl(217 91% 60%/0.3)' };
      default:
        return { bg: 'hsl(var(--primary)/0.1)', text: 'hsl(var(--primary))', border: 'hsl(var(--primary)/0.25)' };
    }
  }

  onDigitOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) { event.preventDefault(); }
  }

  ngOnInit() {
    const saved = localStorage.getItem('melqart_avatar_theme_default');
    if (saved) { this.selectedGradient = saved; }
    this.loadProfile();
  }

  loadProfile() {
    this.profileService.getProfile().subscribe({
      next: (user) => {
        this.profile.prenom = user.prenom;
        this.profile.nom = user.nom;
        this.profile.email = user.email;
        this.profile.telephone = user.telephone;
        this.profile.adresse = user.adresse ?? '';
        this.profile.role = user.role;
        this.isChefDeProjet = user.role === 'CHEF_DE_PROJET' || this.authService.role === 'CHEF_DE_PROJET';
        const p = user.prenom?.[0] ?? '';
        const n = user.nom?.[0] ?? '';
        this.profile.avatar = `${p}${n}` || '?';
        this.profile.profileImage = user.profileImage;
        this.profile.authProvider = user.authProvider;
        this.profile.isEntreprise = user.role === 'CLIENT_ENTREPRISE';
        if (user.organisation) {
          this.profile.raisonSociale = user.organisation.raisonSociale ?? '';
          this.profile.matriculeFiscale = user.organisation.matriculeFiscale ?? '';
          this.profile.organisationLogo = user.organisation.logo;
        }
        const userSavedTheme = localStorage.getItem('melqart_avatar_theme_' + user.email);
        if (userSavedTheme) {
          this.selectedGradient = userSavedTheme;
        }
        this.authService.updateStoredUser(user);
      },
      error: () => {
        this.error = 'Impossible de charger le profil.';
      }
    });
  }

  // ── Map picker ─────────────────────────────────────────
  openMap(): void {
    this.showMapModal = true;
  }

  closeMap(): void {
    this.showMapModal = false;
  }

  onLocationSelected(location: MapLocation): void {
    this.profile.adresse   = location.address;
    this.profile.latitude  = location.lat;
    this.profile.longitude = location.lng;
    this.showMapModal = false;
  }

  // Backend UpdateProfileRequest: nom, prenom, telephone, adresse, latitude, longitude, organisation?
  save() {
    this.error = '';
    this.saving = true;

    const payload: any = {
      nom: this.profile.nom,
      prenom: this.profile.prenom,
      telephone: this.profile.telephone,
      adresse: this.profile.adresse,
      latitude: this.profile.latitude,
      longitude: this.profile.longitude,
      organisation: this.profile.isEntreprise ? {
        raisonSociale: this.profile.raisonSociale,
        matriculeFiscale: this.profile.matriculeFiscale
      } : undefined
    };

    this.profileService.updateProfile(payload).subscribe({
      next: (user) => {
        this.saving = false;
        this.saved = true;
        this.authService.updateStoredUser(user);
        setTimeout(() => this.saved = false, 3000);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || 'Erreur lors de la mise à jour.';
      }
    });
  }

  // ── Avatar upload / delete ──────────────────────────────
  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.avatarService.upload(input.files[0]).subscribe({
        next: (res) => {
          this.profile.profileImage = res.url;
          const currentUser = this.authService.currentUser;
          if (currentUser) {
            currentUser.profileImage = res.url;
            this.authService.updateStoredUser(currentUser);
          }
        },
        error: (err) => { this.error = err.error?.message || 'Erreur lors de l\'upload de la photo.'; }
      });
    }
  }

  removeAvatar() {
    this.avatarService.delete().subscribe({
      next: () => {
        this.profile.profileImage = null;
        const currentUser = this.authService.currentUser;
        if (currentUser) {
          currentUser.profileImage = null;
          this.authService.updateStoredUser(currentUser);
        }
      },
      error: (err) => { this.error = err.error?.message || 'Erreur lors de la suppression.'; }
    });
  }

  // ── Logo upload (entreprise only) ───────────────────────
  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoService.upload(input.files[0]).subscribe({
        next: (res) => {
          this.profile.organisationLogo = res.url;
          const currentUser = this.authService.currentUser;
          if (currentUser) {
            const org = currentUser.organisation ?? ({} as any);
            org.logo = res.url;
            currentUser.organisation = org;
            this.authService.updateStoredUser(currentUser);
          }
        },
        error: (err) => { this.error = err.error?.message || 'Erreur lors de l\'upload du logo.'; }
      });
    }
  }

  removeLogo() {
    this.logoService.delete().subscribe({
      next: () => {
        this.profile.organisationLogo = null;
        const currentUser = this.authService.currentUser;
        if (currentUser?.organisation) {
          currentUser.organisation.logo = null;
          this.authService.updateStoredUser(currentUser);
        }
      },
      error: (err) => { this.error = err.error?.message || 'Erreur lors de la suppression.'; }
    });
  }

  getAvatarUrl(): string {
    return this.profile.profileImage || '';
  }

  getLogoUrl(): string {
    return this.profile.organisationLogo || '';
  }
}
