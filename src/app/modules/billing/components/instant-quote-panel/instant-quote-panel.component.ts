import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';

import { BillingService } from '../../services/billing.service';
import { InstantQuoteResponse, MarginTier, ProductionEstimate } from '../../models/billing.models';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../../../services/auth/auth.service';
import { RouterModule } from '@angular/router';

/**
 * Configurateur de série — devis instantané.
 *
 * Le principe : le prix d'une carte n'est pas un tarif, c'est du temps
 * machine. Ce panneau rend ce temps visible et chiffre la série que le client
 * a demandée au cadrage.
 *
 * La quantité ne se règle pas ici. Elle a été arrêtée à la création du projet,
 * et c'est elle qui court ensuite dans tout le parcours — devis, contrat
 * signé, réservation des composants. La rejouer au moment du prix ferait
 * diverger ces quatre-là sans que personne le voie.
 */
@Component({
  selector: 'app-instant-quote-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instant-quote-panel.component.html',
  styleUrl: './instant-quote-panel.component.css'
})
export class InstantQuotePanelComponent implements OnInit, OnDestroy {

  private billing = inject(BillingService);
  private cartService = inject(CartService);
  private auth = inject(AuthService);

  /**
   * Le détail de fabrication n'est pas pour le client.
   *
   * Nombre de mouvements machine, temps de pose, taux de marge, coût de
   * réglage : ce sont nos chiffres de production, et mis bout à bout ils
   * donnent notre prix de revient — donc notre marge. Le client a besoin d'un
   * prix et d'une quantité ; l'atelier et le chef de projet ont besoin de
   * savoir d'où ce prix sort.
   */
  get isInterne(): boolean {
    const role = this.auth.role;
    // L'ingenieur n'en est pas : il est invite par un client entreprise pour
    // travailler sur les projets de sa societe. Lui montrer notre marge
    // reviendrait a la montrer au client.
    return role === 'ADMINISTRATEUR'
        || role === 'CHEF_DE_PROJET'
        || role === 'TECHNICIEN';
  }

  /** Ajout au panier en cours — le bouton ne doit pas partir deux fois. */
  ajoutEnCours = false;

  /** Le devis est au panier : on montre le chemin plutot que de le repeter. */
  ajoute = false;

  ajoutErreur: string | null = null;

  @Input({ required: true }) projectId!: string;
  /** PROTOTYPE ou PRODUCTION — ailleurs, le devis reste manuel. */
  @Input() objectif?: string;
  /** Quantité déjà saisie au cadrage : point de départ du curseur. */
  @Input() quantiteSouhaitee?: number | null;

  @Output() quoteCreated = new EventEmitter<InstantQuoteResponse>();

  quantity = 1;
  result: InstantQuoteResponse | null = null;

  simulating = false;
  creating = false;
  created = false;
  /** Le devis rendu existait deja : rien n'a ete emis a ce clic. */
  reutilise = false;
  /** Message métier : projet inéligible, Pick & Place manquant… */
  blockedReason: string | null = null;
  error: string | null = null;

  private quantityChanges = new Subject<number>();
  private sub?: Subscription;

  ngOnInit(): void {
    // La quantité vient du cadrage et n'est plus réglable : le client y a
    // déjà répondu en créant son projet, et la rejouer ici referait le devis
    // sous un autre numéro — en détachant le contrat qu'il aurait signé.
    this.quantity = this.quantiteSouhaitee && this.quantiteSouhaitee > 0
      ? this.quantiteSouhaitee
      : 1;

    // Il ne reste qu'un chiffrage à l'ouverture et les reprises après erreur,
    // mais switchMap garde son utilité : il jette la réponse d'un appel lent
    // qui reviendrait après un plus récent.
    this.sub = this.quantityChanges.pipe(
      distinctUntilChanged(),
      switchMap(quantity => {
        this.simulating = true;
        return this.billing.simulateInstantQuote({ projectId: this.projectId, quantity })
          .pipe(catchError(err => { this.handleError(err); return of(null); }));
      })
    ).subscribe(response => {
      this.simulating = false;
      if (!response) return;

      // Une simulation n'a ni numero ni identifiant. Si un devis a deja ete
      // emis pour cette serie, il reste la reference — sinon le telechargement
      // du PDF et l'ajout au panier perdraient l'identifiant qu'ils visent,
      // et le client se retrouverait a en emettre un second.
      this.result = this.created && this.result?.quote?.id
        ? { ...response, quote: this.result.quote }
        : response;
      this.blockedReason = null;
      this.error = null;
    });

    this.simulate();
    this.chargerDevisExistant();
  }

  /**
   * Un devis a-t-il deja ete emis pour cette serie ?
   *
   * Sans cette question, le panneau repartait vierge a chaque ouverture : le
   * bouton « Obtenir ce devis » reapparaissait, et le client cliquait a
   * nouveau sur un devis qu'il possedait deja. Le serveur ne reemet rien —
   * il rend l'existant — mais l'ecran, lui, promettait une emission.
   *
   * On lit donc l'etat au chargement et on affiche le devis tel qu'il est :
   * emis, telechargeable, ajoutable au panier. Plus de bouton d'emission.
   */
  private chargerDevisExistant(): void {
    this.billing.getQuotesByProject(this.projectId).subscribe({
      next: quotes => {
        const vivant = (quotes ?? [])
          .filter(q => q.quoteOrigin === 'INSTANT')
          .filter(q => q.status === 'SENT' || q.status === 'ACCEPTED')
          .filter(q => q.estimate?.quantite === this.quantity)
          // Un devis accepte ne perime pas : le client s'est engage.
          .filter(q => q.status === 'ACCEPTED' || !q.expiresAt || new Date(q.expiresAt) > new Date())
          .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0];

        if (vivant) {
          this.result = { ...(this.result as InstantQuoteResponse), quote: vivant };
          this.created = true;
          this.reutilise = true;
        }
      },
      // L'echec de cette lecture ne doit rien casser : au pire le client
      // reclique, et le serveur lui rend le meme devis.
      error: () => { }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  simulate(): void {
    this.quantityChanges.next(this.quantity);
  }

  /** Crée le devis pour de bon : il part au client, au montant affiché. */
  createQuote(): void {
    if (this.creating || !this.result) return;
    this.creating = true;
    this.error = null;

    this.billing.createInstantQuote({ projectId: this.projectId, quantity: this.quantity })
      .subscribe({
        next: response => {
          this.creating = false;
          this.created = true;
          this.reutilise = !!response.dejaEmis;
          this.result = response;
          this.quoteCreated.emit(response);
        },
        error: err => {
          this.creating = false;
          this.handleError(err);
        }
      });
  }

  private handleError(err: any): void {
    this.simulating = false;
    const status = err?.status;
    const message = err?.error?.message;

    if (status === 422) {
      // Le projet n'entre pas dans le cadre automatique : ce n'est pas une
      // panne, on l'explique et on n'affiche pas de bouton de réessai.
      this.blockedReason = message || "Ce projet ne peut pas être chiffré automatiquement.";
      this.result = null;
    } else if (status === 503) {
      this.error = message || "Le service de chiffrage est momentanément indisponible. Réessayez dans un instant.";
    } else if (status === 403) {
      this.error = "Ce projet ne vous appartient pas.";
    } else {
      this.error = message || "Le chiffrage a échoué.";
    }
  }

  // ── Lecture du résultat ──

  get estimate(): ProductionEstimate | null {
    return this.result?.estimate ?? null;
  }

  get totalTtc(): number {
    return this.result?.quote?.totalTtc ?? 0;
  }

  get totalHt(): number {
    return this.result?.quote?.subtotalHt ?? 0;
  }

  /** Le nombre que le client compare vraiment d'une offre à l'autre. */
  get prixParCarte(): number {
    return this.quantity > 0 ? this.totalTtc / this.quantity : 0;
  }



  /** Mouvements pick & place pour toute la série — le geste réel de la machine. */
  get mouvementsSerie(): number {
    const e = this.estimate;
    return e ? e.totalMouvementsMecaniques * this.quantity : 0;
  }

  /** Durée de fabrication de la série, telle qu'elle occupera l'atelier. */
  get dureeSerieSec(): number {
    const e = this.estimate;
    return e ? e.tempsMachineSec + e.tempsSoudureSec : 0;
  }

  // ── Décomposition du temps d'une carte, en pourcentages ──

  private partOf(value: number): number {
    const e = this.estimate;
    if (!e || e.tempsTotalSecParCarte <= 0) return 0;
    return (value / e.tempsTotalSecParCarte) * 100;
  }

  get partMachine(): number {
    return this.partOf(this.estimate?.tempsMachineSmtSecParCarte ?? 0);
  }

  get partConvoyage(): number {
    return this.partOf(this.estimate?.tempsConvoyageSecParCarte ?? 0);
  }

  get partSoudure(): number {
    return this.partOf(this.estimate?.tempsSoudureSecParCarte ?? 0);
  }

  // ── Tranches de marge, matérialisées sur le curseur ──

  get margeActuelle(): number {
    return this.estimate?.margePercent ?? 0;
  }

  // ── Mise en forme ──

  formatSeconds(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return '—';
    const s = Math.round(totalSeconds);
    if (s < 60) return `${s} s`;
    const minutes = Math.floor(s / 60);
    if (minutes < 60) return `${minutes} min ${String(s % 60).padStart(2, '0')} s`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  }

  get hasWarnings(): boolean {
    return !!this.result?.warnings?.length;
  }

  /**
   * Ajoute le devis affiche au panier.
   *
   * Un devis doit exister avant d'entrer au panier : une simulation n'a ni
   * numero ni identifiant, et le panier pointe sur des devis reels et
   * conserves. On emet donc le devis d'abord s'il ne l'a pas encore ete.
   */
  addToCart(): void {
    if (this.ajoutEnCours) return;
    this.ajoutEnCours = true;
    this.ajoutErreur = null;

    const dejaEmis = this.result?.quote?.id;
    if (dejaEmis) {
      this.pushToCart(dejaEmis);
      return;
    }

    this.billing.createInstantQuote({ projectId: this.projectId, quantity: this.quantity })
      .subscribe({
        next: res => {
          this.result = res;
          this.created = true;
          this.pushToCart(res.quote.id);
        },
        error: err => {
          this.ajoutErreur = this.messageErreur(err);
          this.ajoutEnCours = false;
        }
      });
  }

  private pushToCart(quoteId: string): void {
    this.cartService.addItem({ quoteId }).subscribe({
      next: () => {
        this.ajoute = true;
        this.ajoutEnCours = false;
      },
      error: err => {
        this.ajoutErreur = this.messageErreur(err);
        this.ajoutEnCours = false;
      }
    });
  }

  /** Le devis emis, en PDF — le client le garde, le transmet, le compare. */
  telechargerPdf(): void {
    const id = this.result?.quote?.id;
    if (!id) return;
    this.billing.downloadQuotePdf(id).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Devis_' + (this.result?.quote?.quoteNumber ?? 'devis') + '.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => { this.ajoutErreur = 'Le téléchargement du devis a échoué.'; }
    });
  }

  private messageErreur(err: any): string {
    return err?.error?.message
      ?? err?.error?.error
      ?? "L'ajout au panier a echoue. Reessayez dans un instant.";
  }
}
