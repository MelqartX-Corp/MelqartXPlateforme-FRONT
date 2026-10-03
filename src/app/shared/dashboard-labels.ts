// ═══════════════════════════════════════════════════════════════════════
// LIBELLÉS DES TABLEAUX DE BORD
//
// Les microservices renvoient leurs énumérations telles quelles
// (« PENDING_PAYMENT », « CONTROLE_QUALITE »). La traduction vit ici, en un
// seul endroit : dispersée dans les gabarits, la même clé finissait avec
// trois libellés différents selon la page.
// ═══════════════════════════════════════════════════════════════════════

export const LIBELLES_ROLE: Record<string, string> = {
  CLIENT: 'Clients',
  CLIENT_ENTREPRISE: 'Entreprises',
  INGENIEUR: 'Ingénieurs',
  SUPPORT_TECHNIQUE: 'Support',
  CHEF_DE_PROJET: 'Chefs de projet',
  APPRO: 'Approvisionnement',
  TECHNICIEN: 'Techniciens',
  ADMINISTRATEUR: 'Administrateurs',
};

export const LIBELLES_STATUT_DEVIS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  EXPIRED: 'Expiré',
};

export const LIBELLES_STATUT_FACTURE: Record<string, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  SENT: 'Envoyée',
  PAID: 'Payée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
};

export const LIBELLES_ETAPE_COMMANDE: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  FABRICATION: 'Fabrication',
  ASSEMBLAGE: 'Assemblage',
  CONTROLE_QUALITE: 'Contrôle qualité',
  EXPEDITION: 'Expédition',
};

export const LIBELLES_STATUT_COMMANDE: Record<string, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const LIBELLES_MOYEN_PAIEMENT: Record<string, string> = {
  ONLINE: 'En ligne',
  BANK_TRANSFER: 'Virement',
};

export const LIBELLES_STATUT_TICKET: Record<string, string> = {
  OUVERT: 'Ouverts',
  EN_COURS: 'En cours',
  RESOLU: 'Résolus',
  FERME: 'Fermés',
};

export const LIBELLES_PRIORITE_TICKET: Record<string, string> = {
  URGENTE: 'Critique',
  HAUTE: 'Haute',
  MOYENNE: 'Moyenne',
  BASSE: 'Faible',
};

export const LIBELLES_TYPE_TICKET: Record<string, string> = {
  CONSULTATION: 'Consultation',
  RECLAMATION: 'Réclamation',
};

export const LIBELLES_TRANCHE_AGE: Record<string, string> = {
  MOINS_24H: 'Moins de 24 h',
  '1_3_JOURS': '1 à 3 jours',
  '3_7_JOURS': '3 à 7 jours',
  PLUS_7_JOURS: 'Plus de 7 jours',
};

export const LIBELLES_STATUT_PROJET: Record<string, string> = {
  BROUILLON: 'Brouillon',
  PENDING: 'En attente',
  QUOTED: 'Devis émis',
  CONFIRMED: 'Confirmé',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Livré',
  ARCHIVED: 'Archivé',
  CANCELLED: 'Annulé',
};

export const LIBELLES_OBJECTIF: Record<string, string> = {
  IDEE: 'Idée',
  FAISABILITE: 'Faisabilité',
  PROTOTYPE: 'Prototype',
  VALIDATION: 'Validation',
  PRODUCTION: 'Production',
};

export const LIBELLES_ETAPE_PROJET: Record<string, string> = {
  EN_ATTENTE_CONTACT_SUPPORT: 'Attente contact support',
  EN_COURS_ANALYSE: 'Analyse en cours',
  REDACTION_CAHIER_CHARGES: 'Rédaction du cahier des charges',
  FICHIERS_TECHNIQUES: 'Fichiers techniques',
  PRET_POUR_FLUX: 'Prêt pour le flux',
  ABANDONNE: 'Abandonné',
  FICHIERS_RECUS: 'Fichiers reçus',
  BOM_ANALYSEE: 'BOM analysée',
  EN_ATTENTE_CLIENT: 'Attente client',
  ALTERNATIVES_EN_ATTENTE: 'Alternatives en attente',
  BOM_VALIDEE: 'BOM validée',
  PREPARATION_TESTS: 'Préparation des tests',
  TESTS_EN_COURS: 'Tests en cours',
  RAPPORT_VALIDATION_DISPONIBLE: 'Rapport disponible',
  VALIDATION_TERMINEE: 'Validation terminée',
};

export const LIBELLES_DELAI: Record<string, string> = {
  URGENT: 'Urgent',
  ONE_TO_THREE_MONTHS: '1 à 3 mois',
  THREE_TO_SIX_MONTHS: '3 à 6 mois',
  SIX_PLUS_MONTHS: 'Plus de 6 mois',
};

/**
 * Traduit une clé, ou la rend telle quelle.
 *
 * Rendre la clé brute est délibéré : une valeur ajoutée côté serveur et pas
 * encore traduite doit se voir dans l'interface plutôt que de laisser un
 * libellé vide, qu'on ne remarquerait jamais.
 */
export function traduire(dictionnaire: Record<string, string>, cle: string): string {
  return dictionnaire[cle] ?? cle;
}

/** « 2 j 4 h », « 3 h 20 », « 45 min » — la durée la plus courte qui reste juste. */
export function dureeCourte(heures: number | null | undefined): string {
  if (heures == null) return '—';
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) {
    const h = Math.floor(heures);
    const min = Math.round((heures - h) * 60);
    return min > 0 ? `${h} h ${min}` : `${h} h`;
  }
  const j = Math.floor(heures / 24);
  const h = Math.round(heures % 24);
  return h > 0 ? `${j} j ${h} h` : `${j} j`;
}

/** Les minutes en durée lisible — même règle, autre unité d'entrée. */
export function dureeDepuisMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  return dureeCourte(minutes / 60);
}

/** « à l'instant », « il y a 5 min », « il y a 2 j ». */
export function ilYA(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 31) return `il y a ${jours} j`;
  return d.toLocaleDateString('fr-FR');
}
