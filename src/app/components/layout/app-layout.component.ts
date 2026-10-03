import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent } from './sidebar.component';
import { HeaderComponent } from './header.component';
import { ThemeService } from '../../services';
import { MeetingReminderPopupComponent } from '../../modules/projet/components/meeting-reminder-popup.component';
import { FeedbackPromptModalComponent } from '../../modules/projet/components/feedback-prompt-modal.component';
import { AssistantWidgetComponent } from '../../modules/assistant/components/assistant-widget/assistant-widget.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent, MeetingReminderPopupComponent, FeedbackPromptModalComponent, AssistantWidgetComponent],
  templateUrl: './app-layout.component.html'
})
export class AppLayoutComponent implements OnInit {
  theme = inject(ThemeService);
  isDark = false;

  ngOnInit() {
    this.isDark = this.theme.isDarkMode();
  }
}
