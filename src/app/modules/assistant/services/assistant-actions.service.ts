import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjetService } from '../../projet/services/projet.service';
import { TicketService } from '../../ticket/services/ticket.service';
import { AssistantAction } from '../models/assistant.models';
import { TypeDocumentProjet } from '../../projet/models/projet.models';
import { TicketPriorite } from '../../ticket/models/ticket.models';

export interface ActionOutcome {
  success: boolean;
  detail: string;
  /** Page vers laquelle proposer une navigation après succès. */
  navigateTo?: string;
}

/**
 * Exécution des actions proposées par l'assistant.
 *
 * SÉCURITÉ — pourquoi l'exécution vit ici, et pas côté serveur d'assistant :
 * chaque action passe par les services Angular existants, donc par l'API
 * Gateway avec le JWT de l'utilisateur, et les services métier appliquent
 * leurs propres règles d'autorisation. L'assistant n'obtient ainsi aucun
 * pouvoir que l'utilisateur n'a pas déjà — il lui épargne seulement la
 * navigation. Le fichier ne transite pas non plus par ms-bom.
 *
 * Aucune action destructive n'est implémentée : il n'existe volontairement
 * aucun chemin de code permettant à l'assistant de supprimer ou de valider
 * quoi que ce soit.
 */
@Injectable({ providedIn: 'root' })
export class AssistantActionsService {
  private projets = inject(ProjetService);
  private tickets = inject(TicketService);

  async execute(action: AssistantAction, file: File | null): Promise<ActionOutcome> {
    try {
      switch (action.id) {
        case 'upload_document': return await this.uploadDocument(action, file);
        case 'create_project':  return await this.createProject(action);
        case 'relaunch_dfm':    return await this.relaunchDfm(action);
        case 'open_ticket':     return await this.openTicket(action);
        default:
          // Une action inconnue ne doit jamais s'exécuter, même si elle a
          // franchi le filtrage serveur.
          return { success: false, detail: 'Action non reconnue.' };
      }
    } catch (err: any) {
      return { success: false, detail: this.humanError(err) };
    }
  }

  /** Question de confirmation, jetons {param} remplacés. */
  confirmText(action: AssistantAction, file: File | null, projectName?: string): string {
    const values: Record<string, string> = {
      ...action.params,
      fileName: file?.name ?? 'le fichier',
      projetNom: projectName ?? action.params['projetId'] ?? 'ce projet'
    };
    return action.confirm.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `«${key}»`);
  }

  // ── Implémentations ───────────────────────────────────────────

  private async uploadDocument(action: AssistantAction, file: File | null): Promise<ActionOutcome> {
    const projetId = action.params['projetId'];
    const typeDocument = action.params['typeDocument'] as TypeDocumentProjet;

    if (!file) return { success: false, detail: 'Aucun fichier joint.' };
    if (!projetId) return { success: false, detail: 'Projet non identifié.' };

    await firstValueFrom(this.projets.uploadDocument(projetId, file, typeDocument));
    this.projets.clearCache();

    // Un Gerber déclenche l'analyse DFM : on oriente vers le visualiseur.
    const navigateTo = typeDocument === 'GERBER'
      ? `/client/projets/${projetId}/gerber-viewer`
      : `/client/projets/${projetId}`;

    return { success: true, detail: `${file.name} téléversé (${typeDocument}).`, navigateTo };
  }

  private async createProject(action: AssistantAction): Promise<ActionOutcome> {
    const nom = (action.params['nom'] || '').trim();
    if (!nom) return { success: false, detail: 'Nom de projet manquant.' };

    const projet = await firstValueFrom(
      this.projets.create({ nom, description: action.params['description'] || undefined })
    );
    return {
      success: true,
      detail: `Projet « ${projet.nom} » créé.`,
      navigateTo: `/client/projets/${projet.id}/cadrage`
    };
  }

  private async relaunchDfm(action: AssistantAction): Promise<ActionOutcome> {
    const projetId = action.params['projetId'];
    if (!projetId) return { success: false, detail: 'Projet non identifié.' };

    await firstValueFrom(this.projets.triggerDfmAnalysis(projetId));
    return {
      success: true,
      detail: 'Analyse DFM relancée. Le résultat apparaîtra dans quelques instants.',
      navigateTo: `/client/projets/${projetId}/gerber-viewer`
    };
  }

  private async openTicket(action: AssistantAction): Promise<ActionOutcome> {
    const sujet = (action.params['sujet'] || '').trim();
    const description = (action.params['description'] || '').trim();
    if (!sujet || !description) {
      return { success: false, detail: 'Sujet ou description manquant.' };
    }

    const ticket = await firstValueFrom(this.tickets.create({
      sujet,
      description,
      projetId: action.params['projetId'] || undefined,
      priorite: (action.params['priorite'] as TicketPriorite) || 'MOYENNE'
    }));
    return {
      success: true,
      detail: `Ticket « ${ticket.sujet} » ouvert.`,
      navigateTo: `/client/support/${ticket.id}`
    };
  }

  private humanError(err: any): string {
    if (err?.status === 403) return "Vous n'avez pas les droits pour cette action.";
    if (err?.status === 404) return 'Ressource introuvable.';
    if (err?.status === 400 || err?.status === 422) {
      return err?.error?.message || err?.error?.detail || 'Requête refusée par le serveur.';
    }
    return err?.error?.message || err?.message || 'Action impossible pour le moment.';
  }
}
