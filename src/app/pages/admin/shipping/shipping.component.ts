import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-shipping',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shipping.component.html'
})
export class AdminShippingComponent {
  showAddModal = false;

  shippingZones = [
    {
      id: 1,
      zone: 'Tunisie - Grand Tunis',
      regions: ['Tunis', 'Ariana', 'Ben Arous', 'Manouba'],
      cost: '5.00',
      estimatedDays: '1-2 jours'
    },
    {
      id: 2,
      zone: 'Tunisie - Nord',
      regions: ['Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana'],
      cost: '8.00',
      estimatedDays: '2-3 jours'
    },
    {
      id: 3,
      zone: 'Tunisie - Centre',
      regions: ['Sousse', 'Monastir', 'Mahdia', 'Kairouan', 'Kasserine'],
      cost: '10.00',
      estimatedDays: '2-4 jours'
    },
    {
      id: 4,
      zone: 'Tunisie - Sud',
      regions: ['Sfax', 'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'],
      cost: '15.00',
      estimatedDays: '3-5 jours'
    },
  ];

  carriers = [
    { name: 'Rapid Post', logo: '📦', trackingAvailable: true },
    { name: 'Express Tunisia', logo: '🚚', trackingAvailable: true },
    { name: 'Local Delivery', logo: '🏍️', trackingAvailable: false },
  ];
  
  openAddModal() { this.showAddModal = true; }
  closeAddModal() { this.showAddModal = false; }
}
