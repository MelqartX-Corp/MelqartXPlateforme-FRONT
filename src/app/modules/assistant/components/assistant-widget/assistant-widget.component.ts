import { Component, ElementRef, ViewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AssistantService } from '../../services/assistant.service';
import { AssistantActionsService } from '../../services/assistant-actions.service';
import { AnswerBlock, AssistantMessage, FileAnalysis } from '../../models/assistant.models';

const SUGGESTIONS = [
  'Où je téléverse mon Gerber ?',
  'Pourquoi mon projet est bloqué ?',
  'Crée-moi un nouveau projet',
  'Quelles sont les prochaines étapes ?'
];

const MAX_FILE_MB = 50;

@Component({
  selector: 'app-assistant-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './assistant-widget.component.html',
  styleUrls: ['./assistant-widget.component.scss']
})
export class AssistantWidgetComponent implements OnInit, OnDestroy {
  private assistant = inject(AssistantService);
  private actions = inject(AssistantActionsService);
  private router = inject(Router);

  @ViewChild('scrollZone') scrollZone?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  open = false;
  draft = '';
  sending = false;
  errorMessage = '';
  messages: AssistantMessage[] = [];
  conversationId: string | null = null;
  feedbackGiven: Record<number, 'up' | 'down'> = {};

  /** Fichier joint, conservé jusqu'à ce qu'une action l'utilise. */
  pendingFile: File | null = null;
  /** Page proposée après une action réussie. */
  pendingNavigation: string | null = null;

  /** Analyse du fichier joint (score DFM, composants BOM, pages PDF…). */
  analysis: FileAnalysis | null = null;
  analyzing = false;

  readonly suggestions = SUGGESTIONS;

  private currentPath = '';
  private routerSub?: Subscription;
  private abort?: AbortController;

  ngOnInit(): void {
    this.currentPath = this.router.url;
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => (this.currentPath = (e as NavigationEnd).urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.abort?.abort();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) setTimeout(() => this.scrollToBottom(), 50);
  }

  newConversation(): void {
    this.abort?.abort();
    this.conversationId = null;
    this.messages = [];
    this.feedbackGiven = {};
    this.errorMessage = '';
    this.sending = false;
    this.pendingNavigation = null;
    this.clearFile();
  }

  useSuggestion(text: string): void {
    this.draft = text;
    this.send();
  }

  // ── Pièce jointe ──────────────────────────────────────────────

  pickFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';   // permet de re-sélectionner le même fichier

    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      this.errorMessage = `Fichier trop volumineux (maximum ${MAX_FILE_MB} Mo).`;
      return;
    }
    this.pendingFile = file;
    this.analysis = null;
    this.errorMessage = '';
    this.analyzeAttachment(file);
  }

  /** Analyse le fichier dès qu'il est joint : le contenu, pas seulement le nom. */
  private analyzeAttachment(file: File): void {
    this.analyzing = true;
    this.assistant.analyzeFile(file, this.conversationId).subscribe({
      next: res => {
        this.analyzing = false;
        this.analysis = res.analysis;
        this.conversationId = res.conversationId;
        if (!this.draft.trim()) {
          this.draft = this.defaultQuestionFor(res.analysis);
        }
        this.scrollToBottom();
      },
      error: err => {
        this.analyzing = false;
        this.errorMessage = err?.error?.detail || "Ce fichier n'a pas pu être analysé.";
        this.pendingFile = null;
      }
    });
  }

  /** Question pré-remplie, adaptée à ce que le fichier s'est révélé être. */
  private defaultQuestionFor(analysis: FileAnalysis): string {
    switch (analysis.kind) {
      case 'gerber': return 'Analyse mon Gerber : que dois-je corriger, et où le téléverser ?';
      case 'bom':    return 'Voici ma nomenclature — est-elle exploitable ? Où dois-je la déposer ?';
      case 'pdf':    return 'Résume-moi ce document et dis-moi quoi en faire.';
      default:       return `J'ai joint ${analysis.fileName}, que dois-je en faire ?`;
    }
  }

  /** Couleur de la pastille de grade DFM. */
  gradeClasses(grade?: string): string {
    switch (grade) {
      case 'A': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      case 'B': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
      case 'C': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'D': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
      default:  return 'bg-slate-500/15 text-slate-500';
    }
  }

  clearFile(): void {
    this.pendingFile = null;
    this.analysis = null;
  }

  // ── Envoi ─────────────────────────────────────────────────────

  async send(): Promise<void> {
    const question = this.draft.trim();
    if (!question || this.sending) return;

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
        question, this.conversationId, this.currentPath, this.abort.signal,
        this.pendingFile?.name ?? null
      )) {
        const reply = this.messages[replyIndex];

        if (event.type === 'meta' && event.conversationId) {
          this.conversationId = event.conversationId;
        } else if (event.type === 'chunk' && event.content) {
          reply.content += event.content;
          this.scrollToBottom();
        } else if (event.type === 'blocked') {
          // Le serveur a substitué un refus : on écrase ce qui a pu s'afficher.
          reply.content = event.content || '';
          reply.blocked = true;
          reply.action = undefined;
        } else if (event.type === 'action' && event.action) {
          reply.action = event.action;
          reply.actionState = 'proposed';
        } else if (event.type === 'error') {
          this.errorMessage = event.message || 'Une erreur est survenue.';
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.errorMessage = "L'assistant est momentanément injoignable.";
      }
    } finally {
      const reply = this.messages[replyIndex];
      reply.pending = false;
      if (!reply.content) {
        reply.content = this.errorMessage || "Je n'ai pas pu générer de réponse. Réessayez.";
      }
      this.sending = false;
      this.scrollToBottom();
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

  // ── Actions ───────────────────────────────────────────────────

  confirmLabel(message: AssistantMessage): string {
    return message.action
      ? this.actions.confirmText(message.action, this.pendingFile)
      : '';
  }

  needsMissingFile(message: AssistantMessage): boolean {
    return !!message.action?.requiresFile && !this.pendingFile;
  }

  async runAction(message: AssistantMessage): Promise<void> {
    if (!message.action || message.actionState === 'running') return;

    // Une action de téléversement sans fichier : on ouvre le sélecteur au lieu
    // d'échouer, l'utilisateur n'a pas forcément compris qu'il fallait joindre.
    if (this.needsMissingFile(message)) {
      this.pickFile();
      return;
    }

    message.actionState = 'running';
    const outcome = await this.actions.execute(message.action, this.pendingFile);

    message.actionState = outcome.success ? 'done' : 'failed';
    message.actionDetail = outcome.detail;

    if (outcome.success) {
      this.clearFile();
      this.pendingNavigation = outcome.navigateTo ?? null;
    }

    if (this.conversationId) {
      this.assistant
        .reportActionResult(this.conversationId, message.action.id, outcome.success, outcome.detail)
        .subscribe({ error: () => { /* trace best-effort */ } });
    }

    this.scrollToBottom();
  }

  cancelAction(message: AssistantMessage): void {
    message.actionState = 'cancelled';
  }

  goToResult(): void {
    if (!this.pendingNavigation) return;
    const target = this.pendingNavigation;
    this.pendingNavigation = null;
    this.open = false;
    this.router.navigateByUrl(target);
  }

  // ── Rendu ─────────────────────────────────────────────────────

  blocks(content: string): AnswerBlock[] {
    return this.assistant.parseAnswer(content);
  }

  rate(index: number, rating: 'up' | 'down'): void {
    if (!this.conversationId || this.feedbackGiven[index]) return;
    this.feedbackGiven[index] = rating;
    this.assistant.sendFeedback(this.conversationId, index, rating).subscribe({
      error: () => delete this.feedbackGiven[index]
    });
  }

  goTo(path?: string): void {
    if (!path) return;
    this.router.navigateByUrl(path);
    this.open = false;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollZone?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
