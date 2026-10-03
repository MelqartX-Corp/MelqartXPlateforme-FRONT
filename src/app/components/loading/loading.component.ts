import { Component, OnInit, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLoadingService } from '../../services/ui/app-loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss'
})
export class LoadingComponent implements OnInit {
  private appLoading = inject(AppLoadingService);

  @Output() loadingComplete = new EventEmitter<void>();

  isVisible = true;
  isFadingOut = false;

  ngOnInit(): void {
    // Simulate app initialization - dismiss after 2.8s
    setTimeout(() => {
      this.isFadingOut = true;
      setTimeout(() => {
        this.isVisible = false;
        // Signale aux éléments flottants (popup d'avis…) qu'ils peuvent
        // enfin s'afficher : avant cela ils se dessinent par-dessus cet écran.
        this.appLoading.marquerPret();
        this.loadingComplete.emit();
      }, 600);
    }, 2800);
  }
}
