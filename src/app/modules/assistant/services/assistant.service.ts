import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../user/services/auth/auth.service';
import {
  AnswerBlock,
  AnswerSegment,
  AssistantAction,
  AssistantConversation,
  FileAnalysis,
  KnowledgeEntry
} from '../models/assistant.models';

/** Fragment émis pendant le streaming d'une réponse. */
export interface StreamEvent {
  type: 'meta' | 'chunk' | 'action' | 'blocked' | 'done' | 'error';
  conversationId?: string;
  content?: string;
  message?: string;
  action?: AssistantAction;
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = `${environment.services.gateway}${environment.apiVersion}/assistant`;

  // ── Conversations ─────────────────────────────────────────────

  getConversations(): Observable<AssistantConversation[]> {
    return this.http.get<AssistantConversation[]>(`${this.base}/conversations`);
  }

  getConversation(id: string): Observable<AssistantConversation> {
    return this.http.get<AssistantConversation>(`${this.base}/conversations/${id}`);
  }

  deleteConversation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversations/${id}`);
  }

  sendFeedback(conversationId: string, messageIndex: number, rating: 'up' | 'down'): Observable<void> {
    return this.http.post<void>(`${this.base}/feedback`, { conversationId, messageIndex, rating });
  }

  /**
   * Envoie un message et streame la réponse.
   *
   * `HttpClient` ne sait pas exposer un flux au fil de l'eau : on passe donc par
   * `fetch` + `ReadableStream`. Le JWT est ajouté manuellement, l'intercepteur
   * Angular ne s'appliquant qu'aux requêtes `HttpClient`.
   */
  async *streamChat(
    message: string,
    conversationId: string | null,
    currentPath: string | null,
    signal?: AbortSignal,
    attachedFile?: string | null
  ): AsyncGenerator<StreamEvent> {
    const response = await fetch(`${this.base}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.getToken() ?? ''}`
      },
      body: JSON.stringify({ message, conversationId, currentPath, attachedFile }),
      signal
    });

    if (!response.ok || !response.body) {
      yield { type: 'error', message: `Erreur ${response.status}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';   // la dernière trame peut être incomplète

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          yield JSON.parse(line.slice(6)) as StreamEvent;
        } catch {
          // trame partielle ou malformée — on l'ignore
        }
      }
    }
  }

  /**
   * Envoie le fichier joint pour analyse (Gerber -> DFM, BOM -> composants,
   * PDF -> texte). Le résultat est conservé côté serveur sur la conversation :
   * le navigateur ne le renvoie jamais, il ne pourrait donc pas le falsifier.
   */
  analyzeFile(file: File, conversationId: string | null):
      Observable<{ conversationId: string; analysis: FileAnalysis }> {
    const form = new FormData();
    form.append('file', file);
    if (conversationId) form.append('conversationId', conversationId);
    return this.http.post<{ conversationId: string; analysis: FileAnalysis }>(
      `${this.base}/analyze`, form);
  }

  /** Consigne l'issue d'une action confirmée, pour la trace et le contexte. */
  reportActionResult(
    conversationId: string, actionId: string, success: boolean, detail: string
  ): Observable<void> {
    return this.http.post<void>(`${this.base}/action-result`,
      { conversationId, actionId, success, detail });
  }

  // ── Base de connaissances (ADMINISTRATEUR) ────────────────────

  getKnowledge(): Observable<KnowledgeEntry[]> {
    return this.http.get<KnowledgeEntry[]>(`${this.base}/knowledge`);
  }

  createKnowledge(entry: KnowledgeEntry): Observable<KnowledgeEntry> {
    return this.http.post<KnowledgeEntry>(`${this.base}/knowledge`, entry);
  }

  updateKnowledge(id: string, entry: KnowledgeEntry): Observable<KnowledgeEntry> {
    return this.http.put<KnowledgeEntry>(`${this.base}/knowledge/${id}`, entry);
  }

  deleteKnowledge(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/knowledge/${id}`);
  }

  // ── Rendu des réponses ────────────────────────────────────────

  /**
   * Convertit le Markdown léger renvoyé par le modèle en blocs typés.
   *
   * Aucun HTML n'est injecté : le contenu vient d'un LLM, on ne lui fait pas
   * confiance pour du `innerHTML`. Les liens internes sont extraits pour être
   * rendus en `routerLink` (navigation SPA).
   */
  parseAnswer(markdown: string): AnswerBlock[] {
    return (markdown || '')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        if (/^#{1,6}\s/.test(line)) {
          return { type: 'h' as const, segments: this.parseInline(line.replace(/^#{1,6}\s*/, '')) };
        }
        if (/^[-*•]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
          return {
            type: 'li' as const,
            segments: this.parseInline(line.replace(/^([-*•]|\d+[.)])\s*/, ''))
          };
        }
        return { type: 'p' as const, segments: this.parseInline(line) };
      });
  }

  /** Découpe une ligne en segments texte / lien à partir de `[libellé](/chemin)`. */
  private parseInline(line: string): AnswerSegment[] {
    const segments: AnswerSegment[] = [];
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > cursor) {
        segments.push({ kind: 'text', text: this.stripEmphasis(line.slice(cursor, match.index)) });
      }
      const href = match[2].trim();
      // Seuls les chemins internes deviennent des liens : pas de redirection externe
      segments.push(
        href.startsWith('/')
          ? { kind: 'link', text: match[1], path: href }
          : { kind: 'text', text: match[1] }
      );
      cursor = match.index + match[0].length;
    }

    if (cursor < line.length) {
      segments.push({ kind: 'text', text: this.stripEmphasis(line.slice(cursor)) });
    }
    return segments;
  }

  /** Retire le gras/italique Markdown sans casser les identifiants type TRACE_WIDTH. */
  private stripEmphasis(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$|[.,!?;:])/g, '$1$2')
      .replace(/(^|\s)_(?!\s)(.+?)_(?=\s|$|[.,!?;:])/g, '$1$2')
      .replace(/`/g, '');
  }
}
