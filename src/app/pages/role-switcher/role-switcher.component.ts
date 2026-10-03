import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-role-switcher',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './role-switcher.component.html'
})
export class RoleSwitcherComponent {
  roles = [
    {
      role: 'CLIENT',
      name: 'Client Individuel',
      iconId: 'user',
      color: 'bg-primary',
      description: 'Maker, étudiant, startup',
      features: ['Créer devis PCB/PCBA', 'Suivre commandes', 'Support']
    },
    {
      role: 'CLIENT_ENTREPRISE',
      name: 'Client Entreprise',
      iconId: 'building',
      color: 'bg-warning',
      description: 'Entreprise avec profil organisation',
      features: ['Profil entreprise', 'Gestion devis', 'Multiples commandes']
    },
    {
      role: 'SUPPORT_TECHNIQUE',
      name: 'Support Technique',
      iconId: 'headphones',
      color: 'bg-success',
      description: 'Gère les tickets support',
      features: ['File de tickets', 'Conversations clients', 'Résolution problèmes']
    },
    {
      role: 'CHEF_DE_PROJET',
      name: 'Validateur Technique',
      iconId: 'check',
      color: 'bg-chart-5',
      description: 'Valide les devis techniquement',
      features: ['Valider devis', 'Vérifier specs', 'Approuver/Rejeter']
    },
    {
      role: 'ADMINISTRATEUR',
      name: 'Administrateur',
      iconId: 'shield',
      color: 'bg-destructive',
      description: 'Gestion complète plateforme',
      features: ['Gestion utilisateurs', 'Analytics', 'Configuration système']
    },
    {
      role: 'TECHNICIEN',
      name: 'Technicien',
      iconId: 'wrench',
      color: 'bg-primary',
      description: 'Maintenance et interventions techniques',
      features: ['Interventions terrain', 'Suivi équipements', 'Rapports techniques']
    },
  ];

  constructor(private router: Router) {}

  handleSelectRole(role: string, name: string) {
    localStorage.setItem('userRole', role);
    localStorage.setItem('userName', name);
    if (role === 'CLIENT_ENTREPRISE') {
      localStorage.setItem('companyName', 'Demo Company');
    }
    this.router.navigate(['/dashboard']);
  }
}
