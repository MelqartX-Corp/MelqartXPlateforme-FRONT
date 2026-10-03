// ════════════════════════════════════════════════════════════════
// BILLING DOMAIN MODELS (mirrors ms-billing :8085 DTOs)
// ════════════════════════════════════════════════════════════════

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type ContractStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
/**
 * DEPOSIT / BALANCE : les deux tranches d'un contrat d'etude.
 * FULL : reglement unique — le parcours des commandes Prototype et Production.
 */
export type InvoiceType = 'DEPOSIT' | 'BALANCE' | 'FULL';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';
/**
 * Le seul moyen de reglement offert est la passerelle en ligne.
 *
 * BANK_TRANSFER reste dans le type parce que des reglements passes le portent
 * en base : les afficher demande de savoir le nommer. Le parcours, lui,
 * n'existe plus.
 */
export type PaymentMethod = 'ONLINE' | 'BANK_TRANSFER';
export type BillingMethod = 'TIME' | 'QUANTITY' | 'FIXED';
export type BillingPlanItemStatus = 'PENDING' | 'INVOICED' | 'PAID';
export type ServiceCategory = 'ENGINEERING' | 'PROTOTYPING' | 'MANUFACTURING' | 'COMPONENTS' | 'OTHER';

export interface ServiceCatalog {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  billingMethod: BillingMethod;
  defaultUnit: string;
  active: boolean;
  currentPrice?: PriceVersion;
  createdAt?: string;
}

export interface PriceVersion {
  id?: string;
  serviceId?: string;
  unitPrice: number;
  taxRate: number;
  validFrom: string;
  validTo?: string;
}

export interface QuoteLine {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  subtotalHt: number;
  taxAmount: number;
  totalTtc: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  projectId: string;
  projectName?: string;
  userId: string;
  currency: string;
  lines: QuoteLine[];
  subtotalHt: number;
  totalTax: number;
  totalTtc: number;
  tranche1Percent: number;
  tranche1Amount: number;
  tranche2Percent: number;
  tranche2Amount: number;
  status: QuoteStatus;
  createdBy: string;
  sentAt?: string;
  acceptedAt?: string;
  expiresAt?: string;
  createdAt?: string;
  /**
   * INSTANT pour un devis self-service (Prototype, Production), MANUAL pour un
   * devis rédigé par un chef de projet. Les deux ne se règlent pas pareil :
   * l'un en une fois à la commande, l'autre en deux tranches.
   */
  quoteOrigin?: 'INSTANT' | 'MANUAL';
  /**
   * Instantane du chiffrage au moment de l'emission — dont la quantite.
   * C'est par elle qu'on reconnait un devis deja emis pour cette serie.
   */
  estimate?: ProductionEstimate;
}

export interface BillingPlanItem {
  sequence: number;
  name: string;
  percentage: number;
  amount: number;
  trigger: string;
  status: BillingPlanItemStatus;
}

export interface Contract {
  id: string;
  contractNumber: string;
  quoteId: string;
  projectId: string;
  projectName?: string;
  userId: string;
  currency: string;
  totalHt: number;
  totalTax: number;
  totalTtc: number;
  paymentTermsDays: number;
  billingPlan: BillingPlanItem[];
  status: ContractStatus;
  signedAt: string;
}

export interface InvoiceLine {
  serviceCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  subtotalHt: number;
  taxAmount: number;
  totalTtc: number;
}

export interface CustomerInfo {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  companyName?: string;
  isEnterprise?: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contractNumber: string;
  projectId: string;
  projectName?: string;
  userId: string;
  customer?: CustomerInfo;
  type: InvoiceType;
  currency: string;
  lines: InvoiceLine[];
  subtotalHt: number;
  totalTax: number;
  timbreFiscal: number;
  totalTtc: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt?: string;
}

export interface Payment {
  id: string;
  userId: string;
  invoiceId: string;
  contractId: string;
  projectId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  gatewayProvider?: string;
  gatewayTransactionId?: string;
  bankReference?: string;
  confirmedBy?: string;
  status: PaymentStatus;
  paidAt: string;
  confirmedAt?: string;
}

export interface BillingDashboard {
  contractValue: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalToInvoice: number;
  collectionRate: number;
  activeContractsCount: number;
  pendingInvoicesCount: number;
}

export interface CreateServiceRequest {
  code: string;
  name: string;
  category: ServiceCategory;
  billingMethod: BillingMethod;
  defaultUnit: string;
  unitPrice: number;
  taxRate: number;
}

export interface UpdatePriceRequest {
  unitPrice: number;
  taxRate: number;
  validFrom?: string;
}

export interface CreateQuoteRequest {
  projectId: string;
  projectName?: string;
  userId: string;
  serviceId: string;
  quantity: number;
  description?: string;
}

// ═══════════════════════════════════════════════════════════
//  Devis instantané — Prototype & Production
// ═══════════════════════════════════════════════════════════

/**
 * Réglages de l'atelier. Ce ne sont pas des prix : ce sont les constantes
 * physiques de la ligne SMT, qui transforment un fichier Pick & Place en
 * secondes. Les tarifs, eux, vivent dans le catalogue des services.
 */
export interface ManufacturingParams {
  id?: string;
  machineSpeedCph: number;
  timePerThtPinSec: number;
  /** Chargement et centrage d'une carte — indépendant du nombre de composants. */
  conveyorTimeSec: number;
  /** Réglage machine + feeders : compté UNE fois par série, jamais par carte. */
  /** 1.0 = un technicien reste sur la ligne tant qu'elle tourne. */
  technicianRatio: number;
  marginTiers: MarginTier[];
  updatedBy?: string;
  updatedAt?: string;
}

/** Tranche de marge par quantité — appliquée aux composants uniquement. */
export interface MarginTier {
  minQty: number;
  /** null = pas de plafond (dernière tranche). */
  maxQty: number | null;
  marginPercent: number;
}

/** Photo technique d'un devis instantané : ce qui explique le montant. */
export interface ProductionEstimate {
  nbComposantsSmd: number;
  totalMouvementsMecaniques: number;
  nbComposantsTht: number;
  nbPinsTht: number;
  tempsMachineSmtSecParCarte: number;
  tempsConvoyageSecParCarte: number;
  tempsSoudureSecParCarte: number;
  tempsTotalSecParCarte: number;
  cartesParHeure: number;

  quantite: number;
  tempsMachineSec: number;
  tempsSoudureSec: number;
  heuresMachine: number;
  heuresTechnicienMachine: number;
  heuresTechnicienSoudure: number;

  tarifMachine: number;
  tarifTechnicienMachine: number;
  tarifTechnicienSoudure: number;

  machineSpeedCph: number;
  timePerThtPinSec: number;
  conveyorTimeSec: number;
  technicianRatio: number;

  coutComposantsRevient: number;
  margePercent: number;
  margeMontant: number;
  composantsSansPrix?: string[];
  warnings?: string[];
}

export interface InstantQuoteRequest {
  projectId: string;
  /** Absente = on reprend la quantité déjà saisie au cadrage. */
  quantity?: number;
}

export interface InstantQuoteResponse {
  quote: Quote;
  estimate: ProductionEstimate;
  warnings: string[];
  /** Chiffrage sur données incomplètes : un humain doit relire. */
  needsReview: boolean;
  /**
   * true quand rien n'a été émis : un devis existait déjà pour ce projet à
   * cette quantité et il est renvoyé tel quel. L'écran doit le dire, sinon
   * le client cherche une nouvelle ligne qui n'apparaîtra pas.
   */
  dejaEmis?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ANALYTIQUE FACTURATION — miroir de BillingAnalyticsResponse
// ═══════════════════════════════════════════════════════════════

export interface BillingMonthPoint {
  /** « 2026-03 » — clé stable ; `label` est le libellé français court. */
  month: string;
  label: string;
  count: number;
  invoiced: number;
  collected: number;
  /** Devis acceptés ce mois-là, sur la série des devis uniquement. */
  accepted: number;
}

export interface BillingDayPoint {
  day: string;
  label: string;
  count: number;
  amount: number;
}

export interface BillingKeyCount {
  key: string;
  count: number;
  amount: number;
}

export interface TopCustomer {
  name: string;
  company: string;
  orders: number;
  revenue: number;
}

export interface BillingAnalytics {
  totalQuotes: number;
  acceptedQuotes: number;
  pendingQuotes: number;
  rejectedQuotes: number;
  quotesThisMonth: number;
  quotesLastMonth: number;
  conversionRate: number;
  avgQuoteValue: number;

  totalOrders: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  ordersInProduction: number;
  ordersShipped: number;
  ordersDelivered: number;
  avgOrderValue: number;
  ordersRevenue: number;

  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  overdueAmount: number;

  /** null tant qu'aucune commande n'a été livrée — pas 0, qui se lirait « immédiat ». */
  avgDeliveryDays: number | null;
  avgPaymentDays: number | null;

  revenueByMonth: BillingMonthPoint[];
  quotesByMonth: BillingMonthPoint[];
  ordersByDay: BillingDayPoint[];
  quotesByStatus: BillingKeyCount[];
  invoicesByStatus: BillingKeyCount[];
  ordersByStage: BillingKeyCount[];
  ordersByStatus: BillingKeyCount[];
  paymentsByMethod: BillingKeyCount[];
  topCustomers: TopCustomer[];
}
