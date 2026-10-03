// ═══════════════════════════════════════════════════════════
// REEL STATUS PIPE
// Transforms ReelStatus enum to display object
// ═══════════════════════════════════════════════════════════

import { Pipe, PipeTransform } from '@angular/core';
import { ReelStatus } from '../../modules/stock/models/stock.models';

export interface ReelStatusDisplay {
  label: string;
  cssClass: string;
  emoji: string;
}

@Pipe({ name: 'reelStatus', standalone: true })
export class ReelStatusPipe implements PipeTransform {
  transform(status: ReelStatus): ReelStatusDisplay {
    switch (status) {
      case 'INTACT':
        return { label: 'Intact', cssClass: 'badge-success', emoji: '🟢' };
      case 'OUVERT':
        return { label: 'Ouvert', cssClass: 'badge-warning', emoji: '🟠' };
      case 'VIDE':
        return { label: 'Vide', cssClass: 'badge-destructive', emoji: '🔴' };
      default:
        return { label: status, cssClass: 'badge-muted', emoji: '⚪' };
    }
  }
}
