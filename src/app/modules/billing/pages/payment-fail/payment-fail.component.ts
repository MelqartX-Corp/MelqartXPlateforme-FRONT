import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-payment-fail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-fail.component.html'
})
export class PaymentFailComponent {}
