import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistantService } from '../../services/assistant.service';
import { KnowledgeEntry } from '../../models/assistant.models';

const ALL_ROLES = [
  'CLIENT',
  'CLIENT_ENTREPRISE',
  'CHEF_DE_PROJET',
  'SUPPORT_TECHNIQUE',
  'APPRO',
  'ADMINISTRATEUR'
];

@Component({
  selector: 'app-admin-knowledge',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-knowledge.component.html'
})
export class AdminKnowledgeComponent implements OnInit {
  private assistant = inject(AssistantService);

  entries: KnowledgeEntry[] = [];
  loading = true;
  saving = false;
  errorMessage = '';

  readonly allRoles = ALL_ROLES;

  editing: KnowledgeEntry | null = null;
  tagsInput = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.assistant.getKnowledge().subscribe({
      next: entries => {
        this.entries = entries;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger la base de connaissances.';
        this.loading = false;
      }
    });
  }

  startCreate(): void {
    this.editing = { title: '', content: '', tags: [], roles: [] };
    this.tagsInput = '';
    this.errorMessage = '';
  }

  startEdit(entry: KnowledgeEntry): void {
    this.editing = { ...entry, tags: [...entry.tags], roles: [...entry.roles] };
    this.tagsInput = entry.tags.join(', ');
    this.errorMessage = '';
  }

  cancel(): void {
    this.editing = null;
    this.tagsInput = '';
  }

  toggleRole(role: string): void {
    if (!this.editing) return;
    const roles = this.editing.roles;
    const index = roles.indexOf(role);
    if (index >= 0) roles.splice(index, 1);
    else roles.push(role);
  }

  save(): void {
    if (!this.editing || !this.editing.title.trim() || !this.editing.content.trim()) return;

    this.saving = true;
    this.errorMessage = '';
    const payload: KnowledgeEntry = {
      ...this.editing,
      tags: this.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    };

    const request = payload.id
      ? this.assistant.updateKnowledge(payload.id, payload)
      : this.assistant.createKnowledge(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        this.load();
      },
      error: () => {
        this.saving = false;
        this.errorMessage = "L'enregistrement a échoué.";
      }
    });
  }

  remove(entry: KnowledgeEntry): void {
    if (!entry.id) return;
    this.assistant.deleteKnowledge(entry.id).subscribe({
      next: () => (this.entries = this.entries.filter(e => e.id !== entry.id)),
      error: () => (this.errorMessage = 'La suppression a échoué.')
    });
  }
}
