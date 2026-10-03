import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComponentService } from '../../services/component.service';
import { Component as StockComponent, CLASSIFICATION } from '../../models/stock.models';

@Component({
  selector: 'app-component-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './component-detail.component.html',
})
export class ComponentDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(ComponentService);

  loading = true;
  error = '';
  comp: StockComponent | null = null;
  showLightbox = false;
  classification = CLASSIFICATION;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.svc.getComponent(id).subscribe({
        next: (c) => { this.comp = c; this.loading = false; },
        error: () => { this.error = 'Composant introuvable'; this.loading = false; },
      });
    } else {
      this.error = 'ID manquant';
      this.loading = false;
    }
  }

  openLightbox()  { if (this.comp?.imageUrl) this.showLightbox = true; }
  closeLightbox() { this.showLightbox = false; }

  mslBg(level: number | undefined): string {
    if (!level) return 'hsl(var(--secondary))';
    if (level <= 1) return 'hsl(var(--success)/0.12)';
    if (level <= 3) return 'hsl(var(--warning)/0.12)';
    return 'hsl(var(--destructive)/0.12)';
  }
  mslColor(level: number | undefined): string {
    if (!level) return 'hsl(var(--muted-foreground))';
    if (level <= 1) return 'hsl(var(--success))';
    if (level <= 3) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  }

  goBack() { this.router.navigate(['/stock/components']); }
}
