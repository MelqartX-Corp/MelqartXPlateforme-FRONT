// ════════════════════════════════════════════════════════════════
// PANIER, COMMANDE & LIVRAISON — miroir des DTO de ms-billing :8085
// ════════════════════════════════════════════════════════════════

export type ShippingMethod = 'STANDARD' | 'EXPRESS';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

/** Les cinq colonnes de l'atelier, dans l'ordre. */
export type OrderStage =
  | 'EN_ATTENTE'
  | 'FABRICATION'
  | 'ASSEMBLAGE'
  | 'CONTROLE_QUALITE'
  | 'EXPEDITION';

export type Priorite = 'HAUTE' | 'MOYENNE' | 'BASSE';

/**
 * L'ordre fait foi : c'est lui qui décide de ce qui est « déjà franchi » dans
 * la timeline du client, et de ce qu'un technicien a le droit de faire glisser.
 */
export const ORDER_STAGES: OrderStage[] = [
  'EN_ATTENTE',
  'FABRICATION',
  'ASSEMBLAGE',
  'CONTROLE_QUALITE',
  'EXPEDITION'
];

export interface StageMeta {
  key: OrderStage;
  label: string;
  /** Ce qui se passe réellement à cette étape, dit au client. */
  description: string;
  icon: string;
}

export const STAGE_META: Record<OrderStage, StageMeta> = {
  EN_ATTENTE: {
    key: 'EN_ATTENTE',
    label: 'En attente',
    description: 'Commande réglée, en file de lancement',
    icon: 'clock'
  },
  FABRICATION: {
    key: 'FABRICATION',
    label: 'Fabrication',
    description: 'Préparation des fichiers et gravure du circuit nu',
    icon: 'cpu'
  },
  ASSEMBLAGE: {
    key: 'ASSEMBLAGE',
    label: 'Assemblage',
    description: 'Pose des composants — SMT puis traversants',
    icon: 'layers'
  },
  CONTROLE_QUALITE: {
    key: 'CONTROLE_QUALITE',
    label: 'Contrôle qualité',
    description: 'Inspection optique et tests fonctionnels',
    icon: 'shield-check'
  },
  EXPEDITION: {
    key: 'EXPEDITION',
    label: 'Expédition',
    description: 'Emballage ESD et remise au transporteur',
    icon: 'truck'
  }
};

// ─── Panier ───

export interface CartLine {
  lineId: string;
  quoteId: string;
  quoteNumber: string;
  projectId: string;
  projectName: string;
  quantity: number;
  snapshotTotalTtc: number;
  snapshotSubtotalHt: number;
  /** Poids d'une carte en grammes — null si aucun Gerber lisible. */
  poidsUnitaireG: number | null;
  addedAt: string;
}

export interface CartResponse {
  lines: CartLine[];
  currency: string;
  totalTtc: number;
  /** null dès qu'une carte du panier n'a pas de dimensions connues. */
  poidsTotalG: number | null;
  itemCount: number;
  /**
   * Les projets dont le contrat n'est pas encore signé. Le checkout les
   * refuse ; tant que la liste n'est pas vide, la commande ne peut pas partir.
   */
  contratsManquants: ContratARegulariser[];

  /**
   * Total HT — c'est lui qui decide du franco de port.
   *
   * Comparer un seuil a un montant TTC offrirait la livraison 19 % trop tot,
   * sur des commandes qui n'y ont pas droit.
   */
  totalHt?: number;
  /** Ce panier franchit le seuil : la livraison standard est offerte. */
  livraisonOfferte?: boolean;
  /** Le seuil lui-meme, pour que le client sache ce qu'il vise. */
  seuilFranco?: number | null;
  /** Ce qu'il manque en HT pour l'atteindre — null une fois franchi. */
  resteAvantFranco?: number | null;
}

export interface ContratARegulariser {
  quoteId: string;
  quoteNumber: string;
  projectId: string;
  projectName: string;
  /** true quand le document existe déjà et n'attend que la signature. */
  contratGenere: boolean;
}

export interface AddCartItemRequest {
  quoteId: string;
  quantity?: number;
}

// ─── Livraison ───

/**
 * Une option de livraison chiffrée par le serveur.
 *
 * Le poids et la tranche sont renvoyés volontairement : sans eux, deux
 * commandes identiques à l'œil affichent deux prix différents et personne ne
 * peut dire pourquoi.
 */
export interface ShippingQuote {
  method: ShippingMethod;
  prixHt: number;
  poidsKg: number;
  /** false quand le poids a été supposé faute de Gerber exploitable. */
  poidsMesure: boolean;
  trancheMinKg: number;
  trancheMaxKg: number | null;
  delaiMinJours: number;
  delaiMaxJours: number;
  francoDePort: boolean;
}

export interface ShippingRate {
  id?: string;
  method: ShippingMethod;
  poidsMinKg: number;
  poidsMaxKg: number | null;
  prixHt: number;
  seuilFranco: number | null;
  delaiMinJours: number;
  delaiMaxJours: number;
  actif: boolean;
  updatedBy?: string;
}

// ─── Commande ───

export interface OrderLine {
  quoteId: string;
  quoteNumber: string;
  projectId: string;
  projectName: string;
  quantity: number;
  subtotalHt: number;
  totalTax: number;
  totalTtc: number;
}

export interface ShippingInfo {
  method: ShippingMethod;
  adresse: string;
  gouvernorat: string;
  codePostal?: string;
  contactNom: string;
  contactTelephone: string;
  poidsKg: number;
  poidsMesure: boolean;
  fraisHt: number;
  fraisTva: number;
  fraisTtc: number;
  delaiMinJours: number;
  delaiMaxJours: number;
  transporteur?: string;
  trackingNumber?: string;
}

export interface StageHistory {
  from: OrderStage;
  to: OrderStage;
  movedAt: string;
  movedBy: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCompanyName?: string;
  currency: string;

  lines: OrderLine[];
  shipping: ShippingInfo;

  subtotalHt: number;
  totalTax: number;
  totalTtc: number;

  status: OrderStatus;
  invoiceId?: string;
  invoiceNumber?: string;

  stage: OrderStage;
  priorite: Priorite;
  prioriteMotif?: string;
  prioriteModifieePar?: string;
  assignedTechnicianId?: string;
  stageHistory: StageHistory[];

  placedAt: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface CheckoutRequest {
  method: ShippingMethod;
  adresse: string;
  gouvernorat: string;
  codePostal?: string;
  contactNom: string;
  contactTelephone: string;
  /** Le client confirme un montant qui a bougé depuis sa mise au panier. */
  accepteNouveauPrix?: boolean;
}

/** Les 24 gouvernorats — la livraison couvre toute la Tunisie. */
export const GOUVERNORATS: string[] = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];
