import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-quotes-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quotes-orders.component.html'
})
export class AdminQuotesOrdersComponent {
  activeTab: 'quotes' | 'orders' = 'quotes';
  filterClient = 'all';

  quotes = [
    { ref: 'DEV-2024-001', client: 'John Doe', type: 'PCB', date: '2024-03-15', status: 'SOUMIS', amount: '450.00' },
    { ref: 'DEV-2024-002', client: 'TechCorp SARL', type: 'PCBA', date: '2024-03-18', status: 'VALIDE', amount: '1250.00' },
    { ref: 'DEV-2024-003', client: 'Mohamed Ben Ali', type: 'PCB', date: '2024-03-20', status: 'BROUILLON', amount: '320.00' },
  ];

  orders = [
    { ref: 'CMD-2024-001', client: 'Sarah Smith', date: '2024-03-10', status: 'FABRICATION_PCB', amount: '890.00' },
    { ref: 'CMD-2024-002', client: 'John Doe', date: '2024-03-12', status: 'EXPEDITION', amount: '1450.00' },
    { ref: 'CMD-2024-003', client: 'ElectroPro Solutions', date: '2024-03-05', status: 'LIVRAISON', amount: '720.00' },
  ];

  setActiveTab(tab: 'quotes' | 'orders') {
    this.activeTab = tab;
  }

  setFilterClient(event: Event) {
    this.filterClient = (event.target as HTMLSelectElement).value;
  }
}
