import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-client-order-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-detail.component.html'
})
export class ClientOrderDetailComponent implements OnInit {
  orderId: string = 'CMD-2024-001';
  userRole = 'CLIENT';
  userName = 'Utilisateur';

  order = {
    ref: '',
    date: '2024-03-10',
    status: 'FABRICATION_PCB',
    amount: '890.00',
    adresse: '123 Rue de la Liberté, Tunis 1002, Tunisie'
  };

  timeline = [
    { status: 'DEVIS_CREE', date: '2024-03-10 10:30', completed: true },
    { status: 'VALIDATION_TECHNIQUE', date: '2024-03-10 14:00', completed: true },
    { status: 'FABRICATION_PCB', date: '2024-03-11 09:00', completed: true },
    { status: 'ASSEMBLAGE', date: '', completed: false },
    { status: 'CONTROLE_QUALITE', date: '', completed: false },
    { status: 'EXPEDITION', date: '', completed: false },
    { status: 'LIVRAISON', date: '', completed: false },
    { status: 'CLOTURE', date: '', completed: false },
  ];

  documents = [
    { name: 'Devis_CMD-2024-001.pdf', type: 'DEVIS_PDF', date: '2024-03-10' },
    { name: 'Proforma_CMD-2024-001.pdf', type: 'PROFORMA', date: '2024-03-10' },
    { name: 'Gerber_files.zip', type: 'FICHIER_TECHNIQUE', date: '2024-03-10' },
  ];

  currentStepIndex = 0;

  constructor(private route: ActivatedRoute) {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.orderId = params['id'] || 'CMD-2024-001';
      this.order.ref = this.orderId;
    });
    this.currentStepIndex = this.timeline.findIndex(step => !step.completed);
  }
}
