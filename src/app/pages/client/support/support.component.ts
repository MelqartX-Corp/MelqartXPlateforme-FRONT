import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-client-support',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './support.component.html'
})
export class ClientSupportComponent {
  userRole = 'CLIENT';
  userName = 'Utilisateur';
  showNewTicket = false;

  tickets = [
    { 
      id: 'TIC-001', 
      subject: 'Question sur la finition ENIG', 
      status: 'OUVERT', 
      created: '2024-03-20', 
      lastReply: '2024-03-20',
      messages: 3
    },
    { 
      id: 'TIC-002', 
      subject: 'Délai de livraison CMD-2024-001', 
      status: 'EN_COURS', 
      created: '2024-03-18', 
      lastReply: '2024-03-19',
      messages: 5
    },
    { 
      id: 'TIC-003', 
      subject: 'Problème fichier Gerber', 
      status: 'RESOLU', 
      created: '2024-03-15', 
      lastReply: '2024-03-16',
      messages: 8
    },
  ];

  constructor() {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }

  toggleNewTicket() {
    this.showNewTicket = !this.showNewTicket;
  }

  hideNewTicket() {
    this.showNewTicket = false;
  }
}
