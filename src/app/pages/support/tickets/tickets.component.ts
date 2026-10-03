import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tickets.component.html'
})
export class SupportTicketsComponent {
  userRole = 'SUPPORT_TECHNIQUE';
  userName = 'Support Agent';

  tickets = [
    { 
      id: 'TIC-001', 
      client: 'John Doe',
      orderRef: 'CMD-2024-001',
      subject: 'Question sur la finition ENIG', 
      status: 'OUVERT', 
      priority: 'normal',
      created: '2024-03-20 10:30',
      lastMessage: 'Pouvez-vous m\'expliquer...',
      unread: true
    },
    { 
      id: 'TIC-002', 
      client: 'Sarah Smith',
      orderRef: 'CMD-2024-002',
      subject: 'Délai de livraison', 
      status: 'EN_COURS', 
      priority: 'high',
      created: '2024-03-18 14:20',
      lastMessage: 'Merci pour votre réponse...',
      unread: false
    },
    { 
      id: 'TIC-003', 
      client: 'Mohamed Ben Ali',
      orderRef: 'CMD-2024-005',
      subject: 'Problème fichier Gerber', 
      status: 'EN_COURS', 
      priority: 'urgent',
      created: '2024-03-15 09:15',
      lastMessage: 'J\'ai re-uploadé les fichiers',
      unread: true
    },
    { 
      id: 'TIC-004', 
      client: 'Fatma Trabelsi',
      orderRef: null,
      subject: 'Demande information tarif', 
      status: 'OUVERT', 
      priority: 'normal',
      created: '2024-03-19 16:45',
      lastMessage: 'Je souhaiterais connaître...',
      unread: true
    },
  ];

  constructor() {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }
}
