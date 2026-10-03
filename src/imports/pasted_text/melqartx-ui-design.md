Design a complete modern web application UI for a Tunisian PCB/PCBA manufacturing platform called "MELQARTX". 
The platform allows users to request quotes, place orders, and track PCB and PCBA fabrication. 
Design all screens in dark mode with a professional industrial-tech aesthetic.

---

## Brand & Visual Identity

Name: MELQARTX
Tagline: "Link your fleet, boost your operations"
Style: Dark, modern, industrial-tech, clean minimalist
Primary color: Deep navy/charcoal background (#0F1117 or similar)
Accent color: Electric blue or cyan (#00C2FF or similar) for CTAs, highlights, active states
Secondary accent: Amber/orange (#F59E0B) for warnings, statuses, price highlights
Success: Green (#10B981)
Danger: Red (#EF4444)
Typography: Inter or Space Grotesk — clean, technical feel
All cards and panels: dark surface (#1A1D27 or similar), subtle borders, slight glow on hover
Border radius: 8-12px consistently
Spacing: generous padding, breathable layouts

---

## User Roles & Portals to Design

Design separate dashboard experiences for:
1. CLIENT — individual user (maker, student, startup)
2. CLIENT_ENTREPRISE — company user with organization profile
3. SUPPORT_TECHNIQUE — handles support tickets
4. VALIDATEUR_TECHNIQUE — validates quotes technically
5. ADMINISTRATEUR — full platform management

---

## Screens to Design

### 1. Authentication
- Landing / Login page: centered card, email + password, two CTAs "Se connecter" and links to register
- Register CLIENT: form with nom, prenom, email, mot de passe, telephone, adresse
- Register CLIENT_ENTREPRISE: same fields + raison sociale, matricule fiscale (clearly separated in two sections: "Informations personnelles" and "Informations entreprise")
- Both register forms should feel distinct and purposeful

### 2. CLIENT Dashboard
- Main dashboard: welcome card, quick stats (devis en cours, commandes actives, dernière commande), recent activity feed
- Sidebar navigation: Tableau de bord, Nouveau devis, Mes devis, Mes commandes, Documents, Support

### 3. New PCB Quote (multi-step form — 3 steps)
- Step 1 — Upload: drag & drop zone for Gerber files, large and prominent, with file type hints
- Step 2 — PCB Parameters: form with fields: longueur (mm), largeur (mm), nombre de couches, épaisseur, finition de surface (dropdown), couleur solder mask (color picker: green/red/blue/black/white/yellow), quantité, délai de fabrication (slider or segmented: standard / express / urgent)
- Step 3 — Quote Summary: breakdown card showing coût fabrication, coût livraison, frais supplémentaires, délai estimé, prix total (highlighted in accent color), CTA "Valider le devis"
- Progress indicator at top showing steps 1-2-3

### 4. New PCBA Quote (multi-step form — 4 steps)
- Step 1 — Upload BOM: drag & drop for CSV/Excel BOM file
- Step 2 — Upload Pick & Place file
- Step 3 — Assembly options: card-based selector for assembly type (SMT / THT / MIXTE / SIMPLE_FACE / DOUBLE_FACE) with icons, component analysis results showing available vs missing components
- Step 4 — Quote Summary: coût PCB, coût composants, coût assemblage, coût total

### 5. My Quotes list
- Table/card list of all quotes with columns: référence, type (PCB/PCBA), date, statut (badge: BROUILLON/SOUMIS/VALIDE/EXPIRE/ANNULE), montant, actions
- Filter bar: by type, by status, by date range
- Each row has action buttons: Voir, Commander, Télécharger PDF

### 6. My Orders list
- Similar table with columns: référence, date, statut (rich badge with color: DEVIS_CREE / VALIDATION_TECHNIQUE / FABRICATION_PCB / ASSEMBLAGE / CONTROLE_QUALITE / EXPEDITION / LIVRAISON / CLOTURE)
- Click on order → Order detail page

### 7. Order Detail page
- Left: order info card (référence, date, montant, adresse livraison)
- Center: vertical timeline/stepper showing all order statuses with timestamps, current step highlighted with accent color glow
- Right: documents panel (list of attached documents: devis PDF, proforma, facture, fichiers techniques) with download buttons
- Bottom: support ticket section for this order

### 8. Documents page
- Grid of document cards, each showing: icon by type, nom, type badge (DEVIS_PDF / PROFORMA / FACTURE / FICHIER_TECHNIQUE / BOM / DOCUMENT_LOGISTIQUE), date, download button

### 9. Support page (CLIENT view)
- List of tickets with: sujet, statut badge (OUVERT/EN_COURS/RESOLU/CLOTURE), date creation, dernière réponse
- Button "Nouveau ticket"
- Ticket detail: conversation thread style (like a chat), with messages from client and support alternating sides

### 10. CLIENT_ENTREPRISE — Organisation profile
- Profile card showing: raison sociale, matricule fiscale, adresse
- Edit button to update organisation info
- Same dashboard as CLIENT but with "Mon Organisation" in sidebar

### 11. SUPPORT_TECHNIQUE Dashboard
- Tickets queue: list of open/in-progress tickets assigned to them
- Each ticket: client name, order reference, subject, priority, last message preview
- Ticket detail: full conversation thread + ability to change ticket status + link to related order

### 12. VALIDATEUR_TECHNIQUE Dashboard
- Queue of quotes pending technical validation
- Each item: quote reference, type PCB/PCBA, client name, date submitted, PCB specs summary
- Quote detail: full specs display + approve/reject actions with comment field

### 13. ADMINISTRATEUR Dashboard
- Top KPI cards: total users, total orders, total quotes, open support tickets
- Charts: orders by status (donut), quotes per month (line chart), orders by user type (bar)
- Sidebar: Tableau de bord, Utilisateurs, Organisations, Devis, Commandes, Documents, Support, Tarification, Livraison

### 14. Admin — Users management
- Table: nom, email, role (badge with color per role), actif (toggle), dateCreation, actions
- Button "Créer un utilisateur" → modal form: nom, prenom, email, mot de passe, telephone, role (dropdown limited to SUPPORT_TECHNIQUE / VALIDATEUR_TECHNIQUE / ADMINISTRATEUR)
- Row actions: Voir, Modifier, Désactiver

### 15. Admin — Organisations management
- Table: raison sociale, matricule fiscale, adresse, user associé, dateCreation
- Click to view details

### 16. Admin — Quotes & Orders management
- Tabbed view: Devis | Commandes
- Same tables as client views but showing all users' data, with extra filter by client/organisation

---

## Design System to establish

Create a component library including:
- Buttons: primary (accent blue), secondary (outlined), danger (red), ghost
- Badges/chips for each status (DevisStatus, OrderStatus, TicketStatus, UserRole) — each with its own color
- Form inputs: dark background, accent border on focus, label above, error state below
- Cards: dark surface, subtle border, hover glow
- Table: dark rows, alternating subtle shade, sortable column headers
- Sidebar: collapsible, active item highlighted with accent left border + background
- Stepper/timeline: vertical for order tracking
- Drag & drop upload zone: dashed border, icon, instructions, hover state
- Modal/dialog: dark overlay, centered card
- Notification/toast: top-right, colored by type
- Avatar: initials-based, colored by role

---

## Layout

- Fixed left sidebar (240px expanded, 64px collapsed)
- Top navbar: breadcrumb + user avatar + notifications bell
- Main content area: scrollable, max-width 1280px, centered
- Responsive considerations for tablet (sidebar collapses)

---

## Tone & Feel

The platform serves engineers, makers, startups and industrial companies.
It should feel: precise, trustworthy, professional, modern.
NOT: playful, colorful, consumer-app-like.
Inspiration: Linear.app, Vercel dashboard, Stripe dashboard — but darker and more industrial.
Every screen should feel like a tool built for technical people who care about efficiency.