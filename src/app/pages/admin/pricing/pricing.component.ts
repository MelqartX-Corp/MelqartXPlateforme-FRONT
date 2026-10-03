import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pricing.component.html'
})
export class PricingComponent {
  editingId: number | null = null;

  pricingCategories = [
    {
      id: 1,
      category: 'PCB Standard',
      items: [
        { name: '2 couches', basePrice: '25.00', unit: 'pièce' },
        { name: '4 couches', basePrice: '45.00', unit: 'pièce' },
        { name: '6 couches', basePrice: '85.00', unit: 'pièce' },
      ]
    },
    {
      id: 2,
      category: 'Finitions de surface',
      items: [
        { name: 'HASL', basePrice: '0.00', unit: 'supplément' },
        { name: 'ENIG', basePrice: '15.00', unit: 'supplément' },
        { name: 'OSP', basePrice: '8.00', unit: 'supplément' },
      ]
    },
    {
      id: 3,
      category: 'Assemblage (PCBA)',
      items: [
        { name: 'SMT Simple face', basePrice: '35.00', unit: 'pièce' },
        { name: 'SMT Double face', basePrice: '55.00', unit: 'pièce' },
        { name: 'THT', basePrice: '25.00', unit: 'pièce' },
        { name: 'Mixte (SMT+THT)', basePrice: '65.00', unit: 'pièce' },
      ]
    },
    {
      id: 4,
      category: 'Options de délai',
      items: [
        { name: 'Standard (10-15 jours)', basePrice: '1.0', unit: 'multiplicateur' },
        { name: 'Express (5-7 jours)', basePrice: '1.5', unit: 'multiplicateur' },
        { name: 'Urgent (2-3 jours)', basePrice: '2.0', unit: 'multiplicateur' },
      ]
    },
  ];

  setEditingId(id: number | null) {
    this.editingId = id;
  }
}
