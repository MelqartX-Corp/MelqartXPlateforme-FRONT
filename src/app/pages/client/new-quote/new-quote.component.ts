import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-client-new-quote',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-quote.component.html'
})
export class ClientNewQuoteComponent implements OnInit {
  quoteType: string = 'pcb';
  step: number = 1;
  userRole = 'CLIENT';
  userName = 'Utilisateur';

  formData = {
    longueur: '',
    largeur: '',
    nbCouches: '2',
    epaisseur: '1.6',
    finitionSurface: 'HASL',
    couleurMask: 'Vert',
    quantite: '10',
    delai: 'standard',
    assemblyType: 'SMT' // For PCBA
  };

  constructor(private router: Router, private route: ActivatedRoute) {
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) this.userRole = storedRole;
    const storedName = localStorage.getItem('userName');
    if (storedName) this.userName = storedName;
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.quoteType = params['type'] || 'pcb';
    });
  }

  get totalSteps() {
    return this.quoteType === 'pcb' ? 3 : 4;
  }

  handleNext() {
    if (this.quoteType === 'pcb' && this.step < 3) this.step++;
    if (this.quoteType === 'pcba' && this.step < 4) this.step++;
  }

  handlePrevious() {
    if (this.step > 1) this.step--;
  }

  handleSubmit() {
    // Mock submission
    this.router.navigate(['/quotes']);
  }

  calculatePrice() {
    const basePrice = parseFloat(this.formData.quantite || '0') * 25;
    const delaiMultiplier = this.formData.delai === 'express' ? 1.5 : this.formData.delai === 'urgent' ? 2 : 1;
    const fabrication = basePrice * delaiMultiplier;
    const livraison = 50;
    const total = fabrication + livraison;
    return { fabrication, livraison, total };
  }

  get prices() {
    return this.calculatePrice();
  }

  setDelai(delai: string) {
    this.formData.delai = delai;
  }

  setAssemblyType(type: string) {
    this.formData.assemblyType = type;
  }

  getStepsArray() {
    return Array.from({ length: this.totalSteps }, (_, i) => i + 1);
  }

  getStepLabel(s: number) {
    if (this.quoteType === 'pcb') {
      return ['Upload', 'Paramètres', 'Résumé'][s - 1];
    } else {
      return ['BOM', 'Pick & Place', 'Assemblage', 'Résumé'][s - 1];
    }
  }
}
