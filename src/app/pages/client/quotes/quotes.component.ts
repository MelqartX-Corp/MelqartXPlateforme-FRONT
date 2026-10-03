import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-client-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './quotes.component.html'
})
export class ClientQuotesComponent {
  userRole = 'CLIENT';
  userName = 'Utilisateur';

  filterType = 'all';
  filterStatus = 'all';

  quotes = [
    { ref: 'DEV-2024-001', type: 'PCB', date: '2024-03-15', status: 'SOUMIS', amount: '450.00' },
    { ref: 'DEV-2024-002', type: 'PCBA', date: '2024-03-18', status: 'VALIDE', amount: '1250.00' },
    { ref: 'DEV-2024-003', type: 'PCB', date: '2024-03-20', status: 'BROUILLON', amount: '320.00' },
    { ref: 'DEV-2024-004', type: 'PCBA', date: '2024-03-12', status: 'EXPIRE', amount: '890.00' },
    { ref: 'DEV-2024-005', type: 'PCB', date: '2024-03-10', status: 'ANNULE', amount: '560.00' },
    { ref: 'DEV-2024-006', type: 'PCB', date: '2024-03-08', status: 'VALIDE', amount: '720.00' },
  ];

  constructor() {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }

  get filteredQuotes() {
    return this.quotes.filter(quote => {
      if (this.filterType !== 'all' && quote.type !== this.filterType) return false;
      if (this.filterStatus !== 'all' && quote.status !== this.filterStatus) return false;
      return true;
    });
  }
}
