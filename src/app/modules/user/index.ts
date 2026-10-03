// ═══════════════════════════════════════════════════════════════
// USER MODULE BARREL — re-exports everything from modules/user
// ═══════════════════════════════════════════════════════════════

// ── Models ──────────────────────────────────────────────────────
export * from './models/auth.models';
export * from './models/user.models';
export * from './models/admin.models';
export * from './models/organisation.models';
export * from './models/invitation.models';

// ── Services — Auth ─────────────────────────────────────────────
export { AuthService }         from './services/auth/auth.service';
export { SessionService }      from './services/auth/session.service';
export { BlockedUserService }  from './services/auth/blocked-user.service';

// ── Services — User ─────────────────────────────────────────────
export { ProfileService }  from './services/user/profile.service';
export { AvatarService }   from './services/user/avatar.service';
export { PasswordService } from './services/user/password.service';
export { LogoService }     from './services/user/logo.service';

// ── Services — Admin ────────────────────────────────────────────
export { AdminUserService }         from './services/admin/admin-user.service';
export { AdminSessionService }      from './services/admin/admin-session.service';
export { AdminOrgService }          from './services/admin/admin-org.service';
export { AdminStatsService }        from './services/admin/admin-stats.service';
export { AdminNotificationService } from './services/admin/admin-notification.service';

// ── Services — Invitation ───────────────────────────────────────
export { InvitationService } from './services/invitation/invitation.service';
