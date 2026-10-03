import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Reunion } from '../models/reunion.models';

@Component({
  selector: 'app-meeting-room-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-room-modal.component.html',
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  `]
})
export class MeetingRoomModalComponent {
  @Input({ required: true }) reunion!: Reunion;
  @Output() close = new EventEmitter<void>();

  copied = false;

  copyMeetingLink() {
    if (this.reunion?.lienVisio) {
      navigator.clipboard.writeText(this.reunion.lienVisio);
      this.copied = true;
      setTimeout(() => this.copied = false, 2500);
    }
  }

  onBackdropClick(e: MouseEvent) {
    this.close.emit();
  }
}