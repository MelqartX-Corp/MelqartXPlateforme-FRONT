import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ProjetService } from '../../services/projet.service';
import { ProjetRequest } from '../../models/projet.models';

@Component({
  selector: 'app-projet-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projet-create.component.html',
})
export class ProjetCreateComponent {
  private projetSvc = inject(ProjetService);
  private router = inject(Router);

  saving = false;
  error = '';
  form: ProjetRequest = { nom: '', description: '' };

  create() {
    if (!this.form.nom.trim()) return;
    this.saving = true; this.error = '';
    this.projetSvc.create(this.form).subscribe({
      next: (result) => {
        this.saving = false;
        this.router.navigate(['/client/projets', result.id, 'cadrage']);
      },
      error: (e) => {
        this.saving = false;
        this.error = e.error?.message || 'Erreur lors de la création du projet';
      }
    });
  }
}
