// ═══════════════════════════════════════════════════════════════
// SERVICES BARREL (legacy compatibility layer)
// All services now live in src/app/modules/user/ and src/app/shared/
// This file re-exports them so existing page components compile unchanged.
// ═══════════════════════════════════════════════════════════════

// ── From modules/user ────────────────────────────────────────────
export { AuthService }              from '../modules/user/services/auth/auth.service';
export { SessionService }           from '../modules/user/services/auth/session.service';
export { BlockedUserService }       from '../modules/user/services/auth/blocked-user.service';
export { ProfileService }           from '../modules/user/services/user/profile.service';
export { AvatarService }            from '../modules/user/services/user/avatar.service';
export { LogoService }              from '../modules/user/services/user/logo.service';
export { PasswordService }          from '../modules/user/services/user/password.service';
export { AdminUserService }         from '../modules/user/services/admin/admin-user.service';
export { AdminSessionService }      from '../modules/user/services/admin/admin-session.service';
export { AdminOrgService }          from '../modules/user/services/admin/admin-org.service';
export { AdminStatsService }        from '../modules/user/services/admin/admin-stats.service';
export { AdminNotificationService } from '../modules/user/services/admin/admin-notification.service';
export { InvitationService }        from '../modules/user/services/invitation/invitation.service';

// ── From shared ──────────────────────────────────────────────────
export { ThemeService } from '../shared/services/ui/theme.service';

