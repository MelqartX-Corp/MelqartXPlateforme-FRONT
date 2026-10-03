export const environment = {
  production: false,
  googleMapsApiKey: 'VOTRE_CLE_API_GOOGLE_MAPS',

  apiVersion: '/api/v1',

  // ─── Gateway base URL ───────────────────────────────────────────────────────
  services: { 
    gateway: 'http://localhost:8081',
  },
  googleAuthUrl: 'http://localhost:8089/oauth2/authorization/google',

  // ─── Fonctionnalités activables ────────────────────────────────────────────
  // instantQuote : affiche le devis instantané (fiche projet, page devis,
  // redirection après validation de la BOM). Le backend n'est pas concerné.
  features: {
    instantQuote: false,
  },
};

