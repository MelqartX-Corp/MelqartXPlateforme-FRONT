import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import {
  GOUVERNORATS,
  Order,
  ShippingMethod,
  ShippingQuote
} from '../../models/order.models';

/**
 * Le passage de commande, en trois écrans.
 *
 * L'ordre n'est pas cosmétique : le client arrête d'abord ce qu'il commande,
 * puis dit où et à quelle vitesse il veut être livré, et voit seulement alors
 * le montant qu'il va payer. Demander le mode de livraison plus tôt ferait
 * choisir une vitesse avant de savoir ce qu'elle coûte.
 *
 * Aucun montant n'est calculé ici. Les deux options de livraison sont
 * chiffrées par le serveur, qui pèse le panier et trouve la tranche ; le même
 * calcul sera refait au moment de valider, donc le client paie ce qu'on lui a
 * annoncé.
 */
@Component({
  selector: 'app-client-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-checkout.component.html'
})
export class ClientCheckoutComponent implements OnInit {
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  readonly gouvernorats = GOUVERNORATS;
  readonly cart = this.cartService.cart;

  step = signal<1 | 2 | 3>(1);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  /** Renseigné quand le serveur signale un prix qui a bougé depuis le panier. */
  prixChange = signal<string | null>(null);

  options = signal<ShippingQuote[]>([]);
  method = signal<ShippingMethod>('STANDARD');

  form = {
    adresse: '',
    gouvernorat: '',
    codePostal: '',
    contactNom: '',
    contactTelephone: ''
  };

  readonly lines = computed(() => this.cart()?.lines ?? []);
  readonly currency = computed(() => this.cart()?.currency ?? 'TND');

  readonly choisie = computed(() =>
    this.options().find(o => o.method === this.method()) ?? null);

  /**
   * Taux de TVA appliqué au transport.
   *
   * Il vit côté serveur (billing.default-tax-rate) et le devis de livraison ne
   * renvoie que le HT : le front doit donc le reconstituer. Un seul endroit
   * pour le faire — il était écrit deux fois, dans le calcul et dans le
   * gabarit, et rien ne garantissait qu'ils resteraient d'accord.
   */
  private readonly TAUX_TVA = 1.19;

  /**
   * Le prix de livraison tel que le client le paiera.
   *
   * Les cartes affichaient le HT et le total le TTC : deux montants pour un
   * seul choix, sans que rien ne dise lequel serait débité. On n'affiche donc
   * plus qu'un seul chiffre partout — celui de la facture.
   */
  ttcDe(opt: ShippingQuote | null | undefined): number {
    if (!opt || opt.francoDePort) return 0;
    return opt.prixHt * this.TAUX_TVA;
  }

  // ── La décomposition du total, comme la lira la facture ──
  //
  // L'écran n'affichait que des TTC : la fabrication TVA comprise sans le
  // dire, la livraison HT sur la carte et TTC dans le total. La TVA n'était
  // visible nulle part, si bien qu'elle avait l'air de ne frapper que le
  // transport. Elle porte sur les deux, et se lit maintenant sur sa ligne.

  /** Fabrication hors taxe — le montant des devis du panier. */
  readonly fabricationHt = computed(() => this.cart()?.totalHt ?? 0);

  /** Livraison hors taxe, nulle quand le franco de port s'applique. */
  readonly livraisonHt = computed(() => {
    const port = this.choisie();
    return !port || port.francoDePort ? 0 : port.prixHt;
  });

  readonly sousTotalHt = computed(() => this.fabricationHt() + this.livraisonHt());

  /**
   * La TVA du panier n'est pas recalculée : on prend l'écart entre le TTC et
   * le HT que le serveur a établis. Le refaire ici ferait diverger l'écran de
   * la facture au premier arrondi.
   */
  readonly tva = computed(() => {
    const panierTva = (this.cart()?.totalTtc ?? 0) - this.fabricationHt();
    const portTva = this.ttcDe(this.choisie()) - this.livraisonHt();
    return panierTva + portTva;
  });

  /**
   * Le total affiché à l'étape 3.
   *
   * Les lignes du panier sont TTC, les frais de port viennent HT : la TVA du
   * transport s'y ajoute, sinon le montant annoncé serait inférieur à celui
   * que la facture réclamera.
   */
  readonly totalTtc = computed(() => {
    const panier = this.cart()?.totalTtc ?? 0;
    const port = this.choisie();
    if (!port) return panier;
    return panier + this.ttcDe(port);
  });

  /**
   * Méthode et non `computed` : `form` est un objet simple muté par `ngModel`,
   * pas un signal. Un `computed` ne se recalcule que si un signal qu'il lit
   * change — sans dépendance signal il gardait à vie son premier résultat
   * (`false`, formulaire vide) et le bouton « Vérifier et payer » restait
   * désactivé même une fois l'adresse saisie.
   */
  adresseValide(): boolean {
    return this.form.adresse.trim().length > 0
      && this.form.gouvernorat.length > 0
      && this.form.contactNom.trim().length > 0
      && this.form.contactTelephone.trim().length > 0;
  }

  ngOnInit(): void {
    this.cartService.load().subscribe({
      next: cart => {
        if (!cart.lines?.length) {
          this.router.navigate(['/client/panier']);
          return;
        }
        this.loadShippingOptions();
      },
      error: err => {
        this.error.set(this.messageOf(err));
        this.loading.set(false);
      }
    });
  }

  private loadShippingOptions(): void {
    this.cartService.shippingOptions().subscribe({
      next: options => {
        this.options.set(options);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(this.messageOf(err));
        this.loading.set(false);
      }
    });
  }

  goTo(step: 1 | 2 | 3): void {
    // On ne saute pas en avant sans avoir rempli l'adresse : l'écran de
    // paiement afficherait des frais calculés sur un gouvernorat vide.
    if (step === 3 && !this.adresseValide()) return;
    this.step.set(step);
    this.error.set(null);
  }

  choose(method: ShippingMethod): void {
    this.method.set(method);
  }

  optionFor(method: ShippingMethod): ShippingQuote | undefined {
    return this.options().find(o => o.method === method);
  }

  /**
   * Valide la commande.
   *
   * Le serveur revérifie trois choses avant d'émettre la facture : que le
   * chiffrage est validé, que le prix n'a pas bougé, et que les composants
   * sont toujours disponibles. Un refus n'est donc pas un incident technique —
   * c'est une information que le client doit lire.
   */
  submit(): void {
    if (!this.adresseValide() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.orderService.checkout({
      method: this.method(),
      adresse: this.form.adresse.trim(),
      gouvernorat: this.form.gouvernorat,
      codePostal: this.form.codePostal.trim() || undefined,
      contactNom: this.form.contactNom.trim(),
      contactTelephone: this.form.contactTelephone.trim(),
      accepteNouveauPrix: this.prixChange() !== null
    }).subscribe({
      next: (order: Order) => {
        this.cartService.clearLocal();
        // La commande existe, la facture est émise : on enchaîne sur son
        // règlement plutôt que de laisser le client la chercher.
        this.router.navigate(['/client/billing/pay', order.invoiceId], {
          queryParams: { order: order.orderNumber }
        });
      },
      error: err => {
        const message = this.messageOf(err);
        if (message.includes('prix du devis') || message.includes('a changé')) {
          this.prixChange.set(message);
        } else {
          this.error.set(message);
        }
        this.submitting.set(false);
      }
    });
  }

  accepterNouveauPrix(): void {
    this.prixChange.set(null);
    // Le panier a été rechiffré côté serveur : on relit avant de resoumettre,
    // pour que le montant affiché soit bien celui qui sera prélevé.
    this.cartService.load().subscribe(() => this.loadShippingOptions());
  }

  private messageOf(err: any): string {
    return err?.error?.message
      ?? err?.error?.error
      ?? 'Une erreur est survenue. Réessayez dans un instant.';
  }
}
