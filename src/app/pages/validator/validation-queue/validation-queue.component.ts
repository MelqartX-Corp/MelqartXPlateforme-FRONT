import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChefAvailabilityModalComponent } from '../../../modules/projet/components/chef-availability-modal.component';

@Component({
  selector: 'app-validation-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChefAvailabilityModalComponent],
  templateUrl: './validation-queue.component.html'
})
export class ValidationQueueComponent {
  userRole = 'CHEF_DE_PROJET';
  userName = 'Validateur';
  showAvailabilityModal = false;

  quotesToValidate: Array<{
    ref: string;
    type: string;
    client: string;
    dateSubmitted: string;
    specs: { [key: string]: string | undefined };
  }> = [
    {
      ref: 'DEV-2024-007',
      type: 'PCB',
      client: 'John Doe',
      dateSubmitted: '2024-03-20',
      specs: {
        dimensions: '100 x 80 mm',
        layers: '4 couches',
        thickness: '1.6 mm',
        finish: 'ENIG',
        quantity: '50 pièces'
      }
    },
    {
      ref: 'DEV-2024-008',
      type: 'PCBA',
      client: 'TechCorp SARL',
      dateSubmitted: '2024-03-19',
      specs: {
        dimensions: '150 x 100 mm',
        layers: '2 couches',
        thickness: '1.6 mm',
        finish: 'HASL',
        quantity: '100 pièces',
        assembly: 'SMT + THT'
      }
    },
  ];

  constructor() {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }
}
