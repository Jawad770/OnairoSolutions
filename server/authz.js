/**
 * Server-side authorization.
 *
 * Everything here derives from the session user id and trusted datastore
 * records — never from role names, permission lists or user ids supplied by the
 * browser. Access is denied unless a permission is explicitly granted.
 */

const bcrypt = require("bcryptjs");
const config = require("./config");
const {
  state,
  persist,
  now,
  permissionKeysForUser,
  rolesForUser,
} = require("./db");
const { SUPER_ADMIN_LEVEL } = require("./permissions");

const ACTIVE_STATUSES = ["active"];
const LOGIN_BLOCKED_STATUSES = ["inactive", "suspended", "disabled", "pending"];

function userById(id) {
  return state.users.find((u) => u.id === Number(id)) || null;
}

function userByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  return state.users.find((u) => u.email === needle) || null;
}

function isActive(user) {
  return Boolean(user) && ACTIVE_STATUSES.includes(user.status || (user.is_active ? "active" : "disabled"));
}

function initials(user) {
  const source = (user?.full_name || user?.email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function permissionsOf(userId) {
  return permissionKeysForUser(Number(userId));
}

function roleLevel(userId) {
  const roles = rolesForUser(Number(userId));
  return roles.reduce((max, r) => Math.max(max, r.level || 0), 0);
}

function isSuperAdmin(userId) {
  return rolesForUser(Number(userId)).some((r) => r.key === "super_admin");
}

function activeSuperAdmins() {
  const superRole = state.roles.find((r) => r.key === "super_admin");
  if (!superRole) return [];
  return state.userRoles
    .filter((ur) => ur.role_id === superRole.id)
    .map((ur) => userById(ur.user_id))
    .filter((u) => isActive(u));
}

/** True when removing/disabling `userId` would leave zero active Super Admins. */
function isLastActiveSuperAdmin(userId) {
  const supers = activeSuperAdmins();
  return supers.length <= 1 && supers.some((u) => u.id === Number(userId));
}

function verifyPassword(user, password) {
  if (!user || !password) return false;
  try {
    return bcrypt.compareSync(String(password), user.password_hash);
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Request helpers
 * ------------------------------------------------------------------ */

function wantsJson(req) {
  if (req.path.includes("/api/")) return true;
  const accept = String(req.headers.accept || "");
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return String(req.headers["content-type"] || "").includes("application/json");
}

function currentUser(req) {
  if (!req.session?.user?.id) return null;
  return userById(req.session.user.id);
}

/** Permission set for the active request, cached per request. */
function abilities(req) {
  if (!req._abilities) {
    const user = currentUser(req);
    req._abilities = user ? permissionsOf(user.id) : new Set();
  }
  return req._abilities;
}

function can(req, permission) {
  return abilities(req).has(permission);
}

function canAny(req, permissions) {
  return permissions.some((p) => can(req, p));
}

function unauthorized(req, res, message = "Authentication required.") {
  if (wantsJson(req)) return res.status(401).json({ ok: false, error: message });
  const target = encodeURIComponent(req.originalUrl || config.portalRoute);
  return res.redirect(`${config.portalRoute}/login?next=${target}`);
}

function forbidden(req, res, message = "You do not have permission to perform this action.") {
  if (wantsJson(req)) return res.status(403).json({ ok: false, error: message });
  return res.status(403).send(renderDenied(req, message));
}

let views = null;
function renderDenied(req, message) {
  if (!views) views = require("./portalViews");
  return views.denied({
    portalRoute: config.portalRoute,
    message,
    user: req.session?.user || null,
    nav: navFor(req),
  });
}

/* ------------------------------------------------------------------ *
 * Middleware
 * ------------------------------------------------------------------ */

function requireAuth(req, res, next) {
  if (!req.session?.user?.id) return unauthorized(req, res);
  next();
}

/**
 * Confirms the account still exists, is active, and that the session was
 * issued after the last session revocation for that user. Disabling a user or
 * forcing logout therefore invalidates their live sessions immediately.
 */
function requireLiveSession(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return req.session.destroy(() => unauthorized(req, res, "Account no longer exists."));
  }
  const revokedAt = user.sessions_revoked_at ? new Date(user.sessions_revoked_at).getTime() : 0;
  const issuedAt = req.session.issued_at ? new Date(req.session.issued_at).getTime() : 0;
  if (revokedAt && issuedAt <= revokedAt) {
    return req.session.destroy(() => unauthorized(req, res, "Your session was revoked. Please sign in again."));
  }
  if (!isActive(user)) {
    return req.session.destroy(() => unauthorized(req, res, "This account is not active."));
  }
  req.user = user;
  next();
}

function requireActiveUser(req, res, next) {
  requireLiveSession(req, res, () => {
    // A pending first-login password change blocks the rest of the portal.
    if (req.user.must_change_password && !req.path.startsWith(`${config.portalRoute}/change-password`)) {
      if (wantsJson(req)) {
        return res.status(403).json({ ok: false, error: "Password change required." });
      }
      return res.redirect(`${config.portalRoute}/change-password`);
    }
    next();
  });
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session?.user?.id) return unauthorized(req, res);
    if (!can(req, permission)) {
      recordDenial(req, permission);
      return forbidden(req, res, `Missing permission: ${permission}`);
    }
    next();
  };
}

/** Catalog Manager and other Super-Admin-only surfaces. */
function requireSuperAdmin(req, res, next) {
  if (!req.session?.user?.id) return unauthorized(req, res);
  if (!isSuperAdmin(req.session.user.id)) {
    recordDenial(req, "super_admin");
    return forbidden(req, res, "Super Admin access required");
  }
  next();
}

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.session?.user?.id) return unauthorized(req, res);
    if (!canAny(req, permissions)) {
      recordDenial(req, permissions.join("|"));
      return forbidden(req, res, `Missing permission: one of ${permissions.join(", ")}`);
    }
    next();
  };
}

function requireAllPermissions(permissions) {
  return (req, res, next) => {
    if (!req.session?.user?.id) return unauthorized(req, res);
    const missing = permissions.filter((p) => !can(req, p));
    if (missing.length) {
      recordDenial(req, missing.join("|"));
      return forbidden(req, res, `Missing permission: ${missing.join(", ")}`);
    }
    next();
  };
}

/**
 * Record-level access: the caller may proceed when they hold `permission`
 * (e.g. leads.view_all) or when the record's `ownershipField` points at them.
 * `load(req)` resolves the record from trusted storage.
 */
function requireOwnershipOrPermission(ownershipField, permission, load) {
  return (req, res, next) => {
    if (!req.session?.user?.id) return unauthorized(req, res);
    const record = typeof load === "function" ? load(req) : null;
    if (!record) return res.status(404).send("Not found");
    req.record = record;
    if (can(req, permission)) return next();
    if (Number(record[ownershipField]) === Number(req.session.user.id)) return next();
    recordDenial(req, `${permission}#record:${record.id}`);
    return forbidden(req, res, "This record is not assigned to you.");
  };
}

function recordDenial(req, permission) {
  const { audit } = require("./audit");
  audit(req, "AUTHZ_DENIED", {
    targetType: "permission",
    targetId: permission,
    result: "failure",
    detail: `${req.method} ${req.originalUrl}`,
  });
}

/* ------------------------------------------------------------------ *
 * Privilege-escalation guards
 * ------------------------------------------------------------------ */

/** A user may only hand out roles strictly below their own level. */
function canAssignRole(actorId, role) {
  if (!role) return false;
  if (isSuperAdmin(actorId)) return true;
  if (role.level >= SUPER_ADMIN_LEVEL) return false;
  return role.level < roleLevel(actorId);
}

/** A user may never grant permissions they do not themselves hold. */
function canGrantPermissions(actorId, permissionKeys) {
  if (isSuperAdmin(actorId)) return { ok: true };
  const own = permissionsOf(actorId);
  const escalated = permissionKeys.filter((key) => !own.has(key));
  return escalated.length ? { ok: false, escalated } : { ok: true };
}

/** A user may only edit roles below their own level, and never Super Admin. */
function canEditRole(actorId, role) {
  if (!role) return false;
  if (role.key === "super_admin") return false;
  if (isSuperAdmin(actorId)) return true;
  return role.level < roleLevel(actorId);
}

/** A user may only administer accounts weaker than their own. */
function canManageUser(actorId, targetUser) {
  if (!targetUser) return false;
  if (Number(actorId) === Number(targetUser.id)) return true;
  if (isSuperAdmin(targetUser.id) && !isSuperAdmin(actorId)) return false;
  if (isSuperAdmin(actorId)) return true;
  return roleLevel(targetUser.id) < roleLevel(actorId);
}

/* ------------------------------------------------------------------ *
 * UI helpers (usability only — never a substitute for the checks above)
 * ------------------------------------------------------------------ */

function navFor(req) {
  const { NAV_ITEMS } = require("./permissions");
  const perms = abilities(req);
  return NAV_ITEMS.filter((item) => {
    if (item.hideIf && item.hideIf.some((p) => perms.has(p))) return false;
    // Keep disabled stubs visible when the user can see the section
    if (item.disabled) return item.permission.some((p) => perms.has(p));
    return item.permission.some((p) => perms.has(p));
  }).map((item) => ({
    key: item.key,
    label: item.label,
    path: item.path,
    parent: item.parent || null,
    section: item.section || null,
    disabled: Boolean(item.disabled),
    badge: item.badge || (item.disabled ? "Coming Soon" : null),
  }));
}

function trackSession(req, user) {
  const sid = req.sessionID;
  const existing = state.sessions.find((s) => s.sid === sid);
  const row = {
    id: existing?.id ?? require("./db").nextId("sessions"),
    sid,
    user_id: user.id,
    created_at: existing?.created_at || now(),
    last_seen_at: now(),
    ip_hash: require("./db").hashIp(req.ip),
    user_agent: String(req.headers["user-agent"] || "").slice(0, 250),
    revoked_at: null,
  };
  if (existing) Object.assign(existing, row);
  else state.sessions.push(row);
  persist();
}

/** Invalidate every live session for a user (disable / force logout). */
function revokeSessions(userId) {
  const user = userById(userId);
  if (!user) return;
  user.sessions_revoked_at = now();
  user.updated_at = now();
  state.sessions
    .filter((s) => s.user_id === Number(userId) && !s.revoked_at)
    .forEach((s) => {
      s.revoked_at = now();
    });
  persist();
}

module.exports = {
  ACTIVE_STATUSES,
  LOGIN_BLOCKED_STATUSES,
  userById,
  userByEmail,
  isActive,
  initials,
  permissionsOf,
  roleLevel,
  isSuperAdmin,
  activeSuperAdmins,
  isLastActiveSuperAdmin,
  verifyPassword,
  currentUser,
  can,
  canAny,
  abilities,
  wantsJson,
  unauthorized,
  forbidden,
  requireAuth,
  requireLiveSession,
  requireActiveUser,
  requirePermission,
  requireSuperAdmin,
  requireAnyPermission,
  requireAllPermissions,
  requireOwnershipOrPermission,
  canAssignRole,
  canGrantPermissions,
  canEditRole,
  canManageUser,
  navFor,
  trackSession,
  revokeSessions,
};
