// ═══════════════════════════════════════════════════════════════
// MODELS BARREL (legacy compatibility layer)
// All models now live in src/app/modules/user/ and src/app/shared/
// This file re-exports them so existing page components compile unchanged.
// ═══════════════════════════════════════════════════════════════

// ── From modules/user ────────────────────────────────────────────
export * from '../modules/user/models/auth.models';
export * from '../modules/user/models/user.models';
export * from '../modules/user/models/organisation.models';
export * from '../modules/user/models/admin.models';
export * from '../modules/user/models/invitation.models';

// ── From shared ──────────────────────────────────────────────────
export * from '../shared/models/shared.models';

// ── From modules/stock (new) ────────────────────────────────────
export * from '../modules/stock/models/stock.models';

