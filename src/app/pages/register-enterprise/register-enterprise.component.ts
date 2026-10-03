import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services';
import { MapPickerComponent, MapLocation } from '../../components/map-picker/map-picker.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-register-enterprise',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapPickerComponent],
  templateUrl: './register-enterprise.component.html'
})
export class RegisterEnterpriseComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly googleMapsKey = environment.googleMapsApiKey;

  formData = {
    nom: '',
    prenom: '',
    email: '',
    password: '',
    telephone: '',
    adresse: '',
    latitude: null as number | null,
    longitude: null as number | null,
    raisonSociale: '',
    matriculeFiscale: ''
  };

  error = '';
  submitting = false;
  showPassword = false;
  showMapModal = false;

  onDigitOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) { event.preventDefault(); }
  }

  openMap(): void {
    this.showMapModal = true;
  }

  closeMap(): void {
    this.showMapModal = false;
  }

  onLocationSelected(location: MapLocation): void {
    this.formData.adresse   = location.address;
    this.formData.latitude  = location.lat;
    this.formData.longitude = location.lng;
    this.showMapModal = false;
  }

  handleSubmit(event: Event) {
    event.preventDefault();
    this.error = '';
    this.submitting = true;

    this.authService.register({
      nom:        this.formData.nom,
      prenom:     this.formData.prenom,
      email:      this.formData.email,
      motDePasse: this.formData.password,
      telephone:  this.formData.telephone,
      adresse:    this.formData.adresse,
      latitude:   this.formData.latitude ?? undefined,
      longitude:  this.formData.longitude ?? undefined,
      isEntreprise: true,
      organisation: {
        raisonSociale: this.formData.raisonSociale,
        matriculeFiscale: this.formData.matriculeFiscale
      }
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/verify-email'], { queryParams: { email: this.formData.email } });
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.message || 'Une erreur est survenue lors de l\'inscription.';
      }
    });
  }
}
