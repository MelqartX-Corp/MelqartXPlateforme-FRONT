import { Component, ElementRef, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AssistantService } from '../../services/assistant.service';
import { AuthService } from '../../../user/services/auth/auth.service';
import { AnswerBlock, AssistantConversation, AssistantMessage } from '../../models/assistant.models';

@Component({
  selector: 'app-assistant-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './assistant-page.component.html',
  styleUrls: ['./assistant-page.component.scss']
})
export class AssistantPageComponent implements OnInit {
  private assistant = inject(AssistantService);
  private router = inject(Router);
  private authService = inject(AuthService);

  isExternalUser(): boolean {
    const role = (this.authService as any).role;
    return role === 'CLIENT' || role === 'CLIENT_ENTREPRISE';
  }

  @ViewChild('scrollZone') scrollZone?: ElementRef<HTMLDivElement>;

  conversations: AssistantConversation[] = [];
  messages: AssistantMessage[] = [];
  conversationId: string | null = null;

  draft = '';
  sending = false;
  loadingHistory = true;
  errorMessage = '';
  copiedIndex: number | null = null;

  readonly quickSuggestions = [
    {
      title: 'Où je téléverse mon Gerber ?',
      subtitle: 'Accéder au module DFM et déposer vos fichiers ZIP/GBR',
      tag: 'Gerber DFM'
    },
    {
      title: 'Pourquoi mon projet est bloqué ?',
      subtitle: 'Diagnostiquer les alertes composants ou validations requises',
      tag: 'Diagnostic'
    },
    {
      title: 'Crée-moi un nouveau projet',
      subtitle: 'Initialiser un nouveau dossier de fabrication PCBA',
      tag: 'Nouveau Projet'
    },
    {
      title: 'Quelles sont les prochaines étapes ?',
      subtitle: 'Consulter le planning, approvisionnement et assemblage',
      tag: 'Workflow'
    }
  ];

  private abort?: AbortController;

  ngOnInit(): void {
    this.loadConversations();
  }

  loadConversations(): void {
    this.loadingHistory = true;
    this.assistant.getConversations().subscribe({
      next: list => {
        this.conversations = list;
        this.loadingHistory = false;
      },
      error: () => {
        this.loadingHistory = false;
        this.errorMessage = "Impossible de charger l'historique.";
      }
    });
  }

  openConversation(id: string): void {
    this.abort?.abort();
    this.sending = false;
    this.assistant.getConversation(id).subscribe({
      next: conversation => {
        this.conversationId = conversation.id;
        this.messages = conversation.messages ?? [];
        this.scrollToBottom();
      },
      error: () => (this.errorMessage = 'Conversation introuvable.')
    });
  }

  newConversation(): void {
    this.abort?.abort();
    this.conversationId = null;
    this.messages = [];
    this.errorMessage = '';
    this.sending = false;
  }

  remove(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.assistant.deleteConversation(id).subscribe({
      next: () => {
        this.conversations = this.conversations.filter(c => c.id !== id);
        if (this.conversationId === id) this.newConversation();
      }
    });
  }

  async send(): Promise<void> {
    const question = this.draft.trim();
    if (!question || this.sending) return;

    const isNew = !this.conversationId;
    this.errorMessage = '';
    this.draft = '';
    this.messages.push({ role: 'user', content: question });
    this.messages.push({ role: 'assistant', content: '', pending: true });
    this.sending = true;
    this.scrollToBottom();

    const replyIndex = this.messages.length - 1;
    this.abort = new AbortController();

    try {
      for await (const event of this.assistant.streamChat(
        question, this.conversationId, this.router.url, this.abort.signal
      )) {
        if (event.type === 'meta' && event.conversationId) {
          this.conversationId = event.conversationId;
        } else if (event.type === 'chunk' && event.content) {
          this.messages[replyIndex].content += event.content;
          this.scrollToBottom();
        } else if (event.type === 'error') {
          this.errorMessage = event.message || 'Une erreur est survenue.';
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.errorMessage = "L'assistant est momentanément injoignable.";
      }
    } finally {
      this.messages[replyIndex].pending = false;
      if (!this.messages[replyIndex].content) {
        this.messages[replyIndex].content =
          this.errorMessage || "Je n'ai pas pu générer de réponse. Réessayez.";
      }
      this.sending = false;
      this.scrollToBottom();
      if (isNew) this.loadConversations();
    }
  }

  stop(): void {
    this.abort?.abort();
    this.sending = false;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  blocks(content: string): AnswerBlock[] {
    return this.assistant.parseAnswer(content);
  }

  goTo(path?: string): void {
    if (path) this.router.navigateByUrl(path);
  }

  useSuggestion(text: string): void {
    this.draft = text;
    this.send();
  }

  copyMessage(text: string, index: number): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedIndex = index;
      setTimeout(() => {
        if (this.copiedIndex === index) this.copiedIndex = null;
      }, 2000);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollZone?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
