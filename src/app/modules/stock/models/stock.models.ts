// ════════════════════════════════════════════════════════════════
// STOCK DOMAIN MODELS  (mirrors ms-stock :8090 DTOs)
// ════════════════════════════════════════════════════════════════

// ── Component ────────────────────────────────────────────────────
export type MountType    = 'SMD' | 'THT' | 'MIXTE';
export type PackageType  = string;   // e.g. "QFP", "BGA", "0402"…
export type MslLevel     = 1 | 2 | 3 | 4 | 5 | 6;

export type ComponentCategory =
  | 'SEMI_CONDUCTEURS'
  | 'PASSIFS'
  | 'CONNECTEURS'
  | 'PROTECTION'
  | 'ELECTROMECANIQUE'
  | 'OPTOELECTRONIQUE'
  | 'CAPTEURS'
  | 'ALIMENTATION_THERMIQUE'
  | 'FILS_CABLES';

export type ComponentSubCategory =
  | 'IC' | 'DISCRETS' | 'RF_SANS_FIL'
  | 'CONDENSATEURS' | 'RESISTANCES' | 'INDUCTANCES_SELFS' | 'TRANSFORMATEURS' | 'FILTRES_RESONATEURS'
  | 'CARTE_A_CARTE_FILS_A_CARTE' | 'CONNECTEURS_CIRCULAIRES' | 'DONNEES_ALIMENTATION' | 'RF_COAXIAUX'
  | 'FUSIBLES_SUPPORTS' | 'DISJONCTEURS' | 'SUPPRESSEURS_VARISTANCES'
  | 'RELAIS_SOLENOIDES' | 'INTERRUPTEURS' | 'AUDIO_ACOUSTIQUE' | 'MOTEURS_ACTIONNEURS'
  | 'LED_AFFICHAGES' | 'ISOLATEURS_OPTIQUES' | 'CAPTEURS_OPTIQUES' | 'ECRANS_MODULES'
  | 'ENVIRONNEMENTAUX' | 'MOUVEMENT_POSITION' | 'COURANT_FLUX'
  | 'MODULES_ALIMENTATION' | 'GESTION_THERMIQUE'
  | 'FILS_CABLES_ACCESSOIRES';

export interface CategoryInfo {
  label: string;
  subCategories: { [key in ComponentSubCategory]?: string };
}

export const CLASSIFICATION: Record<ComponentCategory, CategoryInfo> = {
  SEMI_CONDUCTEURS: {
    label: '1. Semi-conducteurs',
    subCategories: {
      IC: 'Circuits intégrés (IC)',
      DISCRETS: 'Semi-conducteurs discrets',
      RF_SANS_FIL: 'RF & Sans-fil'
    }
  },
  PASSIFS: {
    label: '2. Composants passifs',
    subCategories: {
      CONDENSATEURS: 'Condensateurs',
      RESISTANCES: 'Résistances',
      INDUCTANCES_SELFS: 'Inductances & Selfs',
      TRANSFORMATEURS: 'Transformateurs',
      FILTRES_RESONATEURS: 'Filtres & Résonateurs'
    }
  },
  CONNECTEURS: {
    label: '3. Connecteurs',
    subCategories: {
      CARTE_A_CARTE_FILS_A_CARTE: 'Carte à carte / Fils à carte',
      CONNECTEURS_CIRCULAIRES: 'Connecteurs circulaires',
      DONNEES_ALIMENTATION: 'Données & Alimentation',
      RF_COAXIAUX: 'RF / Coaxiaux'
    }
  },
  PROTECTION: {
    label: '4. Protection des circuits',
    subCategories: {
      FUSIBLES_SUPPORTS: 'Fusibles & Supports',
      DISJONCTEURS: 'Disjoncteurs',
      SUPPRESSEURS_VARISTANCES: 'Suppresseurs & Varistances'
    }
  },
  ELECTROMECANIQUE: {
    label: '5. Électromécanique',
    subCategories: {
      RELAIS_SOLENOIDES: 'Relais & Solénoïdes',
      INTERRUPTEURS: 'Interrupteurs',
      AUDIO_ACOUSTIQUE: 'Audio & Acoustique',
      MOTEURS_ACTIONNEURS: 'Moteurs & Actionneurs'
    }
  },
  OPTOELECTRONIQUE: {
    label: '6. Optoélectronique',
    subCategories: {
      LED_AFFICHAGES: 'LED & Affichages',
      ISOLATEURS_OPTIQUES: 'Isolateurs optiques',
      CAPTEURS_OPTIQUES: 'Capteurs optiques',
      ECRANS_MODULES: 'Écrans & Modules'
    }
  },
  CAPTEURS: {
    label: '7. Capteurs',
    subCategories: {
      ENVIRONNEMENTAUX: 'Environnementaux',
      MOUVEMENT_POSITION: 'Mouvement & Position',
      COURANT_FLUX: 'Courant & Flux'
    }
  },
  ALIMENTATION_THERMIQUE: {
    label: '8. Alimentation & Gestion Thermique',
    subCategories: {
      MODULES_ALIMENTATION: "Modules d'alimentation",
      GESTION_THERMIQUE: 'Gestion thermique'
    }
  },
  FILS_CABLES: {
    label: '9. Fils, Câbles et Accessoires',
    subCategories: {
      FILS_CABLES_ACCESSOIRES: 'Fils, Câbles et Accessoires'
    }
  }
};

export interface Component {
  id:           string;
  manufacturer: string;
  mpn:          string;
  description?: string;
  packageType?: string;
  mountType?:   MountType;
  mslLevel?:    MslLevel;
  imageUrl?:    string;
  seuilMinReels?: number;
  category?:    ComponentCategory;
  subCategory?: ComponentSubCategory;
  createdAt?:   string;
}

export interface ComponentRequest {
  manufacturer: string;
  mpn:          string;
  description?: string;
  packageType?: string;
  mountType?:   MountType;
  mslLevel?:    MslLevel;
  seuilMinReels?: number;
  category?:    ComponentCategory;
  subCategory?: ComponentSubCategory;
}

// ── Supplier ─────────────────────────────────────────────────────
export interface Supplier {
  id:              string;
  name:            string;
  source?:         string;
  createdAt?:      string;
}

export interface SupplierRequest {
  name:            string;
  source?:         string;
}

export interface LotLine {
  componentId: string;
  mpn?: string;
  manufacturer?: string;
  expectedQuantity: number;
  receivedQuantity?: number;
  remainingQuantity?: number;
  complete?: boolean;
}

export interface LotLineRequest {
  componentId: string;
  expectedQuantity: number;
}

export interface Lot {
  id:              string;
  supplierId?:     string;
  manufacturerLot?: string;
  dateCode?:       string;
  firstReceptionDate?: string;
  receivedDate?:   string;
  totalExpected?:  number;
  totalReceived?:  number;
  receptionProgress?: number;
  status?:         'COMMANDE' | 'PARTIELLEMENT_RECU' | 'RECU';
  estimatedDeliveryDate?: string;
  lines?:          LotLine[];
  createdAt?:      string;
  supplierName?:   string;
}

export interface LotRequest {
  supplierId?:      string;
  manufacturerLot?: string;
  dateCode?:        string;
  receivedDate?:    string;
  status?:          'COMMANDE' | 'PARTIELLEMENT_RECU' | 'RECU';
  estimatedDeliveryDate?: string;
  lines?:           LotLineRequest[];
}

export interface ReelReceptionRequest {
  componentId: string;
  serialnumber: string;
  quantityInitial: number;
  storageLocationId: string;
  marque?: string;
  prix?: number;
}

export interface LotReceptionRequest {
  reels: ReelReceptionRequest[];
}


// ── Storage Location ─────────────────────────────────────────────
export type SlotStatus = 'LIBRE' | 'OCCUPE' | 'CIBLE_ACTIVE';
export type WarehouseType = 'MAGASIN' | 'PRODUCTION';

export interface StorageLocation {
  id:         string;
  warehouse:  WarehouseType;
  zone?:      string;
  rack?:      string;
  shelf?:     string;
  slot?:      string;
  fullPath?:  string;
  slotStatus: SlotStatus;
  reelCount:  number;
}

export interface StorageLocationRequest {
  warehouse:   WarehouseType;
  zone?:       string;
  rack?:       string;
  shelf?:      string;
  slot?:       string;
  slotStatus?: SlotStatus;
}

// ── Reel ─────────────────────────────────────────────────────────
export type ReelStatus = 'INTACT' | 'OUVERT' | 'VIDE';

/**
 * Ou en est une bobine du point de vue de l'atelier.
 *
 * Deduit cote serveur de l'emplacement et du projet occupant : le statut seul
 * (INTACT / OUVERT / VIDE) ne distingue pas une bobine rangee en production
 * d'une bobine montee sur une machine, et c'est cette distinction que le
 * technicien a besoin de lire.
 */
export type ReelProductionState =
  | 'EN_MAGASIN'
  | 'EN_STOCK_PRODUCTION'
  | 'EN_MACHINE'
  | 'OCCUPEE'
  | 'EPUISEE';

export interface Reel {
  id:               string;
  lotId:            string;
  componentId:      string;
  serialnumber:     string;
  quantityInitial:  number;
  quantityRemaining: number;
  /** Mis de cote pour des projets payes — encore physiquement sur la bobine. */
  quantityReserved?: number;
  /** quantityRemaining - quantityReserved : ce que les autres projets peuvent prendre. */
  quantityAvailable?: number;
  status:           ReelStatus;
  storageLocationId?: string;
  locationFullPath?:  string;
  openedDate?:       string;
  createdAt?:        string;
  updatedAt?:        string;
  // Enriched
  componentMpn?:         string;
  manufacturer?:         string;
  componentMountType?:   MountType;
  // ── Atelier ───────────────────────────────────────────────────
  /** Renseigne : la bobine est sur une machine, personne d'autre n'y touche. */
  currentProjetId?:      string;
  currentProjetNom?:     string;
  issuedToProductionAt?: string;
  productionState?:      ReelProductionState;
  warehouse?:            WarehouseType;
  // Informations commerciales
  marque?:               string;
  prix?:                 number;
}

// ── Atelier : preparation, mouvements, tracabilite ───────────────

export type MovementType =
  | 'ISSUE'
  | 'CONSUMPTION'
  | 'THT_ISSUE'
  | 'ADJUSTMENT'
  | 'SCRAP';

/**
 * Une ligne de la liste de preparation d'un projet.
 *
 * Le technicien ne choisit pas les bobines et n'en compte pas les pieces : la
 * reservation l'a fait au paiement. Il lit, il va chercher, il rend.
 */
export interface KittingLine {
  reelId:             string;
  serialnumber:       string;
  componentId:        string;
  componentMpn?:      string;
  manufacturer?:      string;
  mountType?:         MountType;
  /** Ce que CE projet doit prendre sur CETTE bobine. */
  quantityForProject: number;
  /** Deja retire : la bobine est revenue, il n'y a plus rien a faire. */
  consumed:           boolean;
  quantityRemaining?: number;
  quantityAvailable?: number;
  status:             ReelStatus;
  state:              ReelProductionState;
  storageLocationId?: string;
  locationFullPath?:  string;
  /** Renseignes seulement quand la bobine est retenue par un autre projet. */
  blockingProjetId?:  string;
  blockingProjetNom?: string;
  issuedToProductionAt?: string;
  /** Pilote la case a cocher : la bobine peut-elle bouger maintenant. */
  actionable:         boolean;
  blockedReason?:     string;
}

export interface StockMovement {
  id:                string;
  reelId:            string;
  serialnumber?:     string;
  componentId?:      string;
  componentMpn?:     string;
  projetId?:         string;
  type:              MovementType;
  quantity:          number;
  fromLocationPath?: string;
  toLocationPath?:   string;
  userId?:           string;
  note?:             string;
  createdAt?:        string;
}

/**
 * Resultat d'une sortie ou d'un retour.
 *
 * Le serveur ne s'arrete pas a la premiere bobine en defaut : sur cinq
 * bobines, quatre valides partent quand meme. C'est ici qu'on lit le reste.
 */
export interface ProductionActionResult {
  projetId:  string;
  succeeded: number;
  failed:    number;
  results: Array<{
    reelId:             string;
    serialnumber?:      string;
    ok:                 boolean;
    quantity:           number;
    quantityRemaining?: number;
    message?:           string;
  }>;
}

export interface IssueReelsRequest {
  reelIds: string[];
  note?:   string;
}

export interface ReturnReelsRequest {
  items: Array<{
    reelId:            string;
    toLocationId?:     string;
    /** Ne se saisit qu'en cas d'ecart : sans elle, le prevu fait foi. */
    quantityConsumed?: number;
  }>;
  note?: string;
}

export interface ThtIssueRequest {
  reelId:   string;
  quantity: number;
  note?:    string;
}

export interface ProjectTraceability {
  projetId:    string;
  projetNom?:  string;
  totalPieces: number;
  reelCount:   number;
  components: Array<{
    componentId:   string;
    mpn?:          string;
    manufacturer?: string;
    totalQuantity: number;
    reels: Array<{
      reelId:           string;
      serialnumber?:    string;
      quantity:         number;
      lotId?:           string;
      manufacturerLot?: string;
      dateCode?:        string;
      supplierId?:      string;
      supplierName?:    string;
      userId?:          string;
      consumedAt?:      string;
    }>;
  }>;
}

export interface ReelRequest {
  lotId:            string;
  componentId:      string;
  serialnumber:     string;
  quantityInitial:  number;
  storageLocationId?: string;
  // Mutable on update
  quantityRemaining?: number;
  status?:           ReelStatus;
  // Informations commerciales
  marque?:           string;
  prix?:             number;
}

// ── Stock Summary ────────────────────────────────────────────────
export interface ComponentStockSummary {
  componentId:           string;
  componentMpn:          string;
  manufacturer:          string;
  reelCount:             number;
  totalQuantityInitial:  number;
  totalQuantityRemaining: number;
  intactCount:           number;
  ouvertCount:           number;
  videCount:             number;
  intactQuantityRemaining?: number;
  ouvertQuantityRemaining?: number;

  // Ce qu'un projet payé a mis de côté, et ce qui reste réellement à prendre.
  // Le serveur les calculait déjà ; le modèle ne les déclarait pas, alors
  // aucun écran ne pouvait les lire — le stock s'affichait donc au brut, et
  // l'appro croyait disponible ce qui était promis.
  totalQuantityReserved?:   number;
  intactQuantityAvailable?: number;
  ouvertQuantityAvailable?: number;

  seuilMinReels?:        number;
  belowThreshold:        boolean;
}
