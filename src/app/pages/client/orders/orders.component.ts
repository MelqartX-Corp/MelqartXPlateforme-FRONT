import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-client-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './orders.component.html'
})
export class ClientOrdersComponent {
  userRole = 'CLIENT';
  userName = 'Utilisateur';

  orders = [
    { ref: 'CMD-2024-001', date: '2024-03-10', status: 'FABRICATION_PCB', amount: '890.00' },
    { ref: 'CMD-2024-002', date: '2024-03-12', status: 'EXPEDITION', amount: '1450.00' },
    { ref: 'CMD-2024-003', date: '2024-03-05', status: 'LIVRAISON', amount: '720.00' },
    { ref: 'CMD-2024-004', date: '2024-03-08', status: 'ASSEMBLAGE', amount: '1250.00' },
    { ref: 'CMD-2024-005', date: '2024-02-28', status: 'CLOTURE', amount: '560.00' },
    { ref: 'CMD-2024-006', date: '2024-03-15', status: 'VALIDATION_TECHNIQUE', amount: '980.00' },
  ];

  constructor() {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }
}
