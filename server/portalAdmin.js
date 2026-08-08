/**
 * Users & Roles administration: user CRUD, role management with a permission
 * matrix, secure staff invitations, audit log viewer and password changes.
 *
 * Every route is guarded by permission middleware; the UI only hides what the
 * server already refuses to serve.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const { sendMail, smtpReady } = require("./mailer");
const {
  state,
  persist,
  nextId,
  now,
  setRolePermissions,
  permissionKeysForRole,
  permissionKeysForUser,
  rolesForUser,
} = require("./db");
const perms = require("./permissions");
const authz = require("./authz");

const { esc } = views;
const R = config.portalRoute;
const USER_STATUSES = ["active", "inactive", "suspended", "pending", "disabled"];

function roleById(id) {
  return state.roles.find((r) => r.id === Number(id)) || null;
}

function primaryRole(userId) {
  const roles = rolesForUser(userId);
  return roles.sort((a, b) => (b.level || 0) - (a.level || 0))[0] || null;
}

function usersInRole(roleId) {
  return state.userRoles.filter((ur) => ur.role_id === Number(roleId)).length;
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < config.minPasswordLength) {
    return `Password must be at least ${config.minPasswordLength} characters.`;
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}

function randomPassword() {
  return `On${crypto.randomBytes(6).toString("hex")}!${crypto.randomInt(10, 99)}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/** Sensitive actions must be confirmed with the actor's current password. */
function reauthenticate(req) {
  const actor = authz.currentUser(req);
  const password = req.body?.currentPassword;
  if (!password) return "Confirm this action with your current password.";
  if (!authz.verifyPassword(actor, password)) return "Current password is incorrect.";
  return null;
}

function statusBadge(status) {
  const cls = status === "active" ? "ok" : status === "pending" || status === "inactive" ? "warn" : "off";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function flash(req) {
  const notice = req.query.notice ? `<div class="notice">${esc(req.query.notice)}</div>` : "";
  const error = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : "";
  return notice + error;
}

function redirectWith(res, path, params) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${path}${qs ? `?${qs}` : ""}`);
}

module.exports = function registerAdminRoutes({ app, csrf, token, portalShell }) {
  const guard = [authz.requireAuth, authz.requireActiveUser];
  const { isWebsitePricingVisible, setWebsitePricingVisible } = require("./siteSettings");

  /* ---------------------------------------------------------------- *
   * Settings home — website pricing visibility (Super Admin)
   * ---------------------------------------------------------------- */

  app.get(`${R}/settings`, ...guard, authz.requirePermission("settings.view"), (req, res) => {
    const showPricing = isWebsitePricingVisible();
    const canUpdate = authz.can(req, "settings.update") || authz.isSuperAdmin(req.session.user.id);
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head"><strong>Settings</strong></div>
      <div class="actions" style="margin-top:4px;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        ${authz.can(req, "users.view") ? `<a class="btn" href="${R}/settings/users">Users</a>` : ""}
        ${authz.can(req, "roles.view") ? `<a class="btn" href="${R}/settings/roles">Roles &amp; Permissions</a>` : ""}
        <a class="btn" href="${R}/change-password">Change my password</a>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <div>
          <strong>Website pricing</strong>
          <div class="muted">Show or hide price cards and plans on the public website (Pricing page, EduTrack plans, etc.).</div>
        </div>
        <span class="badge ${showPricing ? "ok" : "off"}">${showPricing ? "Visible" : "Hidden"}</span>
      </div>
      ${
        canUpdate
          ? `<form method="post" action="${R}/settings/website-pricing" style="margin-top:12px">
        ${csrfField}
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;max-width:40rem">
          <input type="checkbox" name="showPricing" value="1" ${showPricing ? "checked" : ""} style="margin-top:3px">
          <span>Show price cards / plans on the website</span>
        </label>
        <p class="muted" style="margin:10px 0 14px">When unchecked, public visitors will not see pricing sections even if plans exist in Catalog Manager.</p>
        <button class="btn primary" type="submit">Save pricing visibility</button>
      </form>`
          : `<p class="muted" style="margin-top:12px">You can view this setting but need <code>settings.update</code> (or Super Admin) to change it.</p>`
      }
    </div>`;
    res.send(portalShell("Settings", inner, req));
  });

  app.post(
    `${R}/settings/website-pricing`,
    ...guard,
    csrf,
    authz.requirePermission("settings.update"),
    async (req, res) => {
      const show = req.body.showPricing === "1" || req.body.showPricing === "on" || req.body.showPricing === "true";
      await setWebsitePricingVisible(show);
      audit(req, "SETTINGS_WEBSITE_PRICING", {
        targetType: "system_setting",
        targetId: "website.show_pricing",
        next: { showPricing: show },
      });
      redirectWith(res, `${R}/settings`, {
        notice: show ? "Website pricing is now visible." : "Website pricing is now hidden.",
      });
    }
  );

  /* ---------------------------------------------------------------- *
   * Own password (also the forced-change screen)
   * ---------------------------------------------------------------- */

  app.get(`${R}/change-password`, authz.requireAuth, authz.requireLiveSession, (req, res) => {
    const user = req.user;
    res.send(
      views.standalone({
        portalRoute: R,
        title: "Change password",
        heading: "Change your password",
        description: user.must_change_password
          ? "Your account requires a new password before you can continue."
          : "Choose a new password for your portal account.",
        error: req.query.error,
        formHtml: `<form method="post" action="${R}/change-password">
          <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
          <div class="row"><label>Current password</label><input type="password" name="currentPassword" required autocomplete="current-password"></div>
          <div class="row"><label>New password</label><input type="password" name="newPassword" required autocomplete="new-password"></div>
          <div class="row"><label>Confirm new password</label><input type="password" name="confirmPassword" required autocomplete="new-password"></div>
          <button class="btn primary" type="submit">Update password</button>
        </form>`,
      })
    );
  });

  app.post(`${R}/change-password`, authz.requireAuth, authz.requireLiveSession, csrf, (req, res) => {
    const user = req.user;
    const { newPassword, confirmPassword } = req.body;
    const fail = (error) => redirectWith(res, `${R}/change-password`, { error });

    if (!authz.verifyPassword(user, req.body.currentPassword)) {
      audit(req, "PASSWORD_CHANGE", { targetType: "user", targetId: user.id, result: "failure" });
      return fail("Current password is incorrect.");
    }
    if (newPassword !== confirmPassword) return fail("New passwords do not match.");
    const invalid = validatePassword(newPassword);
    if (invalid) return fail(invalid);

    user.password_hash = bcrypt.hashSync(String(newPassword), 12);
    user.must_change_password = 0;
    user.password_changed_at = now();
    user.updated_at = now();
    persist();
    audit(req, "PASSWORD_CHANGED", { targetType: "user", targetId: user.id });
    redirectWith(res, R, { notice: "Password updated." });
  });

  /* ---------------------------------------------------------------- *
   * Users
   * ---------------------------------------------------------------- */

  app.get(`${R}/settings/users`, ...guard, authz.requirePermission("users.view"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const roleFilter = String(req.query.role || "");
    const statusFilter = String(req.query.status || "");
    const sort = String(req.query.sort || "created");
    const dir = req.query.dir === "asc" ? "asc" : "desc";
    const perPage = 10;
    const page = Math.max(1, Number(req.query.page) || 1);

    let rows = state.users.map((u) => {
      const role = primaryRole(u.id);
      return { user: u, role, creator: state.users.find((c) => c.id === u.created_by) || null };
    });

    if (q) {
      rows = rows.filter(({ user, role }) =>
        [user.full_name, user.email, user.job_title, user.phone, role?.name].join(" ").toLowerCase().includes(q)
      );
    }
    if (roleFilter) rows = rows.filter(({ role }) => role?.key === roleFilter);
    if (statusFilter) rows = rows.filter(({ user }) => user.status === statusFilter);

    const sorters = {
      name: (a, b) => String(a.user.full_name || "").localeCompare(String(b.user.full_name || "")),
      email: (a, b) => a.user.email.localeCompare(b.user.email),
      role: (a, b) => String(a.role?.name || "").localeCompare(String(b.role?.name || "")),
      status: (a, b) => String(a.user.status).localeCompare(String(b.user.status)),
      last_login: (a, b) => String(a.user.last_login_at || "").localeCompare(String(b.user.last_login_at || "")),
      created: (a, b) => String(a.user.created_at).localeCompare(String(b.user.created_at)),
    };
    rows.sort(sorters[sort] || sorters.created);
    if (dir === "desc") rows.reverse();

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const pageRows = rows.slice((page - 1) * perPage, page * perPage);
    const canUpdate = authz.can(req, "users.update");
    const canCreate = authz.can(req, "users.create");

    const query = (overrides) => {
      const params = new URLSearchParams({ q, role: roleFilter, status: statusFilter, sort, dir, page: String(page), ...overrides });
      [...params.entries()].forEach(([k, v]) => {
        if (!v) params.delete(k);
      });
      return `?${params.toString()}`;
    };

    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div>
          <strong>Users</strong>
          <div class="muted">${total} account${total === 1 ? "" : "s"} • <a href="${R}/settings/roles" style="text-decoration:underline">Roles &amp; Permissions</a></div>
        </div>
        ${canCreate ? `<a class="btn primary" href="${R}/settings/users/new">Add User</a>` : ""}
      </div>
      <form class="toolbar" method="get">
        <input type="search" name="q" value="${esc(q)}" placeholder="Search name, email, phone">
        <select name="role"><option value="">All roles</option>${state.roles
          .map((r) => `<option value="${esc(r.key)}" ${r.key === roleFilter ? "selected" : ""}>${esc(r.name)}</option>`)
          .join("")}</select>
        <select name="status"><option value="">All statuses</option>${USER_STATUSES.map(
          (s) => `<option value="${s}" ${s === statusFilter ? "selected" : ""}>${s}</option>`
        ).join("")}</select>
        <select name="sort">${[
          ["created", "Created date"],
          ["name", "Name"],
          ["email", "Email"],
          ["role", "Role"],
          ["status", "Status"],
          ["last_login", "Last login"],
        ]
          .map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>Sort: ${l}</option>`)
          .join("")}</select>
        <select name="dir">
          <option value="desc" ${dir === "desc" ? "selected" : ""}>Descending</option>
          <option value="asc" ${dir === "asc" ? "selected" : ""}>Ascending</option>
        </select>
        <button class="btn">Apply</button>
      </form>
      <table class="stack" style="margin-top:12px">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Created by</th><th>Actions</th></tr></thead>
        <tbody>
        ${pageRows
          .map(({ user, role, creator }) => `<tr>
            <td data-label="User"><span class="who">${views.avatar(user)}<span>${esc(user.full_name || "—")}${user.job_title ? `<div class="muted">${esc(user.job_title)}</div>` : ""}</span></span></td>
            <td data-label="Email">${esc(user.email)}</td>
            <td data-label="Role">${role ? `<span class="badge">${esc(role.name)}</span>` : '<span class="badge off">No role</span>'}</td>
            <td data-label="Status">${statusBadge(user.status)}</td>
            <td data-label="Last login">${esc(user.last_login_at ? user.last_login_at.slice(0, 16).replace("T", " ") : "Never")}</td>
            <td data-label="Created">${esc(String(user.created_at).slice(0, 10))}</td>
            <td data-label="Created by">${esc(creator ? creator.full_name || creator.email : "System")}</td>
            <td data-label="Actions"><span class="actions"><a class="btn sm" href="${R}/settings/users/${user.id}">${canUpdate ? "Manage" : "View"}</a></span></td>
          </tr>`)
          .join("") || `<tr><td colspan="8" class="muted">No users match these filters.</td></tr>`}
        </tbody>
      </table>
      <div class="pager">
        ${Array.from({ length: pages }, (_, i) => i + 1)
          .map((p) => (p === page ? `<span class="on">${p}</span>` : `<a href="${query({ page: String(p) })}">${p}</a>`))
          .join("")}
        <span class="muted">Page ${page} of ${pages}</span>
      </div>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.get(`${R}/settings/users/new`, ...guard, authz.requirePermission("users.create"), (req, res) => {
    const actorId = req.session.user.id;
    const assignable = state.roles.filter((r) => authz.canAssignRole(actorId, r));
    const inner = `${flash(req)}
    <div class="panel" style="max-width:720px">
      <div class="panel-head"><strong>Add User</strong><a class="btn sm" href="${R}/settings/users">Back</a></div>
      <p class="muted">Public registration is disabled. Accounts can only be created here.</p>
      <form method="post" action="${R}/settings/users">
        <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
        <div class="row2">
          <div class="row"><label>Full name *</label><input name="fullName" required></div>
          <div class="row"><label>Email *</label><input type="email" name="email" required></div>
        </div>
        <div class="row2">
          <div class="row"><label>Job title</label><input name="jobTitle"></div>
          <div class="row"><label>Phone number</label><input name="phone"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Role *</label><select name="roleId" required>${assignable
            .map((r) => `<option value="${r.id}">${esc(r.name)}</option>`)
            .join("")}</select></div>
          <div class="row"><label>Profile image URL</label><input name="avatarUrl" placeholder="Optional"></div>
        </div>
        <div class="row"><label>Account creation method *</label>
          <select name="method">
            <option value="invite">Send invitation (user sets their own password)</option>
            <option value="temporary">Create with temporary password</option>
          </select>
        </div>
        <div class="row2">
          <div class="row"><label>Temporary password (leave blank to auto-generate)</label><input name="temporaryPassword" autocomplete="new-password"></div>
          <div class="row"><label>Account status</label><select name="status">${USER_STATUSES.filter((s) => s !== "pending")
            .map((s) => `<option value="${s}" ${s === "active" ? "selected" : ""}>${s}</option>`)
            .join("")}</select></div>
        </div>
        <div class="row" style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" id="mcp" name="mustChangePassword" checked><label for="mcp" style="margin:0">Require password change on first login</label></div>
        <div class="row" style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" id="welcome" name="sendWelcomeEmail" checked><label for="welcome" style="margin:0">Send welcome email${smtpReady ? "" : " (SMTP not configured — link shown here instead)"}</label></div>
        <div class="row"><label>Confirm with your current password (required when creating a Super Admin)</label><input type="password" name="currentPassword" autocomplete="current-password"></div>
        <button class="btn primary" type="submit">Create user</button>
      </form>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.post(`${R}/settings/users`, ...guard, csrf, authz.requirePermission("users.create"), async (req, res) => {
    const actorId = req.session.user.id;
    const b = req.body || {};
    const fail = (error) => redirectWith(res, `${R}/settings/users/new`, { error });

    const email = String(b.email || "").trim().toLowerCase();
    const fullName = String(b.fullName || "").trim();
    if (!email || !fullName) return fail("Name and email are required.");
    if (authz.userByEmail(email)) return fail("A user with that email already exists.");

    const role = roleById(b.roleId);
    if (!role) return fail("Select a valid role.");
    // Privilege escalation guard: role must be below the actor's authority.
    if (!authz.canAssignRole(actorId, role)) {
      audit(req, "USER_CREATE", { targetType: "user", targetId: email, result: "failure", detail: `Blocked role assignment: ${role.key}` });
      return authz.forbidden(req, res, "You cannot assign a role at or above your own authority.");
    }
    if (role.key === "super_admin") {
      const problem = reauthenticate(req);
      if (problem) return fail(problem);
    }

    const method = b.method === "temporary" ? "temporary" : "invite";
    let temporaryPassword = null;
    if (method === "temporary") {
      temporaryPassword = String(b.temporaryPassword || "").trim() || randomPassword();
      const invalid = validatePassword(temporaryPassword);
      if (invalid) return fail(invalid);
    }

    const ts = now();
    const user = {
      id: nextId("users"),
      email,
      full_name: fullName,
      job_title: String(b.jobTitle || "").trim() || null,
      phone: String(b.phone || "").trim() || null,
      avatar_url: String(b.avatarUrl || "").trim() || null,
      password_hash: bcrypt.hashSync(temporaryPassword || crypto.randomBytes(32).toString("hex"), 12),
      role: role.key,
      status: method === "invite" ? "pending" : USER_STATUSES.includes(b.status) ? b.status : "active",
      is_active: method === "invite" ? 0 : 1,
      must_change_password: method === "temporary" && b.mustChangePassword === "on" ? 1 : 0,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      password_changed_at: ts,
      sessions_revoked_at: null,
      created_by: actorId,
      created_at: ts,
      updated_at: ts,
    };
    state.users.push(user);
    state.userRoles.push({
      id: nextId("userRoles"),
      user_id: user.id,
      role_id: role.id,
      assigned_at: ts,
      assigned_by: actorId,
    });
    persist();

    let notice = `User ${email} created with role ${role.name}.`;
    if (method === "invite") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      state.invitations.push({
        id: nextId("invitations"),
        user_id: user.id,
        email,
        role_id: role.id,
        token_hash: hashToken(rawToken),
        status: "pending",
        expires_at: new Date(Date.now() + config.inviteExpiryHours * 3600 * 1000).toISOString(),
        used_at: null,
        created_by: actorId,
        created_at: ts,
      });
      persist();
      const link = `${req.protocol}://${req.get("host")}${R}/invite/${rawToken}`;
      audit(req, "USER_INVITED", { targetType: "user", targetId: user.id, next: { email, role: role.key } });
      const mailed = b.sendWelcomeEmail === "on"
        ? await sendMail({
            to: email,
            subject: "Your Onairo Portal invitation",
            text: `Hello ${fullName},\n\nYou have been invited to the Onairo Portal.\n\nSet your password here (expires in ${config.inviteExpiryHours} hours):\n${link}\n\nIf you did not expect this, ignore this email.`,
          }).catch(() => false)
        : false;
      // Without SMTP the one-time link is surfaced in the UI only, never logged.
      notice = mailed
        ? `${notice} Invitation email sent.`
        : `${notice} Invitation link (single use, expires in ${config.inviteExpiryHours}h): ${link}`;
    } else {
      audit(req, "USER_CREATED", { targetType: "user", targetId: user.id, next: { email, role: role.key, status: user.status } });
      if (b.sendWelcomeEmail === "on") {
        await sendMail({
          to: email,
          subject: "Your Onairo Portal account",
          text: `Hello ${fullName},\n\nAn account has been created for you on the Onairo Portal.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nYou will be asked to choose a new password when you sign in.`,
        }).catch(() => false);
      }
      notice = `${notice} Temporary password: ${temporaryPassword}`;
    }
    redirectWith(res, `${R}/settings/users`, { notice });
  });

  app.get(`${R}/settings/users/:id`, ...guard, authz.requirePermission("users.view"), (req, res) => {
    const actorId = req.session.user.id;
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    const role = primaryRole(user.id);
    const manageable = authz.canManageUser(actorId, user);
    const canUpdate = authz.can(req, "users.update") && manageable;
    const canAssign = authz.can(req, "roles.assign") && manageable;
    const canDisable = authz.can(req, "users.disable") && manageable;
    const canReset = authz.can(req, "users.reset_password") && manageable;
    const canDelete = authz.can(req, "users.delete") && manageable;
    const assignable = state.roles.filter((r) => authz.canAssignRole(actorId, r));
    const grantedPermissions = [...permissionKeysForUser(user.id)].sort();
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const lastSuper = authz.isLastActiveSuperAdmin(user.id);

    const inner = `${flash(req)}
    <div class="panel" style="max-width:820px">
      <div class="panel-head">
        <div class="who">${views.avatar(user)}<div>
          <strong>${esc(user.full_name || user.email)}</strong>
          <div class="muted">${esc(user.email)} • ${esc(role?.name || "No role")} • ${esc(user.status)}</div>
        </div></div>
        <a class="btn sm" href="${R}/settings/users">Back</a>
      </div>
      ${lastSuper ? `<div class="notice">This is the last active Super Admin. Disabling, deleting or demoting this account is blocked.</div>` : ""}
      <form method="post" action="${R}/settings/users/${user.id}">
        ${csrfField}
        <div class="row2">
          <div class="row"><label>Full name</label><input name="fullName" value="${esc(user.full_name)}" ${canUpdate ? "" : "disabled"}></div>
          <div class="row"><label>Email</label><input type="email" name="email" value="${esc(user.email)}" ${canUpdate ? "" : "disabled"}></div>
        </div>
        <div class="row2">
          <div class="row"><label>Job title</label><input name="jobTitle" value="${esc(user.job_title || "")}" ${canUpdate ? "" : "disabled"}></div>
          <div class="row"><label>Phone</label><input name="phone" value="${esc(user.phone || "")}" ${canUpdate ? "" : "disabled"}></div>
        </div>
        <div class="row"><label>Last login</label><input value="${esc(user.last_login_at || "Never")}" disabled></div>
        ${canUpdate ? `<button class="btn primary" type="submit">Save changes</button>` : `<p class="muted">You have read-only access to this account.</p>`}
      </form>
    </div>

    ${canAssign ? `<div class="panel" style="max-width:820px">
      <strong>Change role</strong>
      <form method="post" action="${R}/settings/users/${user.id}/role" style="margin-top:10px">
        ${csrfField}
        <div class="row"><label>Role</label><select name="roleId">${assignable
          .map((r) => `<option value="${r.id}" ${role?.id === r.id ? "selected" : ""}>${esc(r.name)}</option>`)
          .join("")}</select></div>
        <div class="row"><label>Confirm with your current password (required for Super Admin changes)</label><input type="password" name="currentPassword"></div>
        <button class="btn" type="submit">Update role</button>
      </form>
    </div>` : ""}

    <div class="panel" style="max-width:820px">
      <strong>Account actions</strong>
      <div class="actions" style="margin-top:10px">
        ${canReset ? `<form method="post" action="${R}/settings/users/${user.id}/reset-password">${csrfField}<button class="btn sm" type="submit">Reset password</button></form>` : ""}
        ${canUpdate ? `<form method="post" action="${R}/settings/users/${user.id}/force-logout">${csrfField}<button class="btn sm" type="submit">Force logout</button></form>` : ""}
      </div>
      ${canDisable ? `<form method="post" action="${R}/settings/users/${user.id}/status" style="margin-top:14px">
        ${csrfField}
        <div class="row2">
          <div class="row"><label>Account status</label><select name="status">${USER_STATUSES.map(
            (s) => `<option value="${s}" ${s === user.status ? "selected" : ""}>${s}</option>`
          ).join("")}</select></div>
          <div class="row"><label>Confirm with your current password</label><input type="password" name="currentPassword"></div>
        </div>
        <button class="btn" type="submit">Update status</button>
        <p class="muted" style="margin:8px 0 0">Suspended, inactive, pending and disabled accounts cannot sign in. Live sessions are revoked immediately.</p>
      </form>` : ""}
      ${canDelete ? `<form method="post" action="${R}/settings/users/${user.id}/delete" style="margin-top:14px" onsubmit="return confirm('Delete this account permanently?')">
        ${csrfField}
        <div class="row"><label>Confirm with your current password to delete</label><input type="password" name="currentPassword"></div>
        <button class="btn danger" type="submit">Delete account</button>
      </form>` : ""}
    </div>

    <div class="panel" style="max-width:820px">
      <strong>Effective permissions (${grantedPermissions.length})</strong>
      <div class="perms" style="margin-top:10px">${grantedPermissions
        .map((p) => `<span class="badge">${esc(p)}</span>`)
        .join("") || '<span class="muted">No permissions granted.</span>'}</div>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.post(`${R}/settings/users/:id`, ...guard, csrf, authz.requirePermission("users.update"), (req, res) => {
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    if (!authz.canManageUser(req.session.user.id, user)) {
      return authz.forbidden(req, res, "You cannot modify this account.");
    }
    const previous = { full_name: user.full_name, email: user.email, job_title: user.job_title, phone: user.phone };
    const email = String(req.body.email || user.email).trim().toLowerCase();
    const clash = authz.userByEmail(email);
    if (clash && clash.id !== user.id) {
      return redirectWith(res, `${R}/settings/users/${user.id}`, { error: "That email is already in use." });
    }
    user.full_name = String(req.body.fullName || user.full_name).trim();
    user.email = email;
    user.job_title = String(req.body.jobTitle || "").trim() || null;
    user.phone = String(req.body.phone || "").trim() || null;
    user.updated_at = now();
    persist();
    audit(req, "USER_UPDATED", {
      targetType: "user",
      targetId: user.id,
      previous,
      next: { full_name: user.full_name, email: user.email, job_title: user.job_title, phone: user.phone },
    });
    redirectWith(res, `${R}/settings/users/${user.id}`, { notice: "Account updated." });
  });

  app.post(`${R}/settings/users/:id/role`, ...guard, csrf, authz.requirePermission("roles.assign"), (req, res) => {
    const actorId = req.session.user.id;
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    const role = roleById(req.body.roleId);
    const back = (params) => redirectWith(res, `${R}/settings/users/${user.id}`, params);

    if (!role) return back({ error: "Select a valid role." });
    if (!authz.canManageUser(actorId, user)) return authz.forbidden(req, res, "You cannot modify this account.");
    if (!authz.canAssignRole(actorId, role)) {
      audit(req, "USER_ROLE_CHANGE", { targetType: "user", targetId: user.id, result: "failure", detail: `Blocked: ${role.key}` });
      return authz.forbidden(req, res, "You cannot assign a role at or above your own authority.");
    }
    // A user may never promote themselves.
    if (Number(actorId) === user.id && role.level > authz.roleLevel(actorId)) {
      audit(req, "USER_ROLE_CHANGE", { targetType: "user", targetId: user.id, result: "failure", detail: "Self escalation blocked" });
      return authz.forbidden(req, res, "You cannot raise your own role.");
    }
    const previousRole = primaryRole(user.id);
    if (previousRole?.key === "super_admin" && role.key !== "super_admin" && authz.isLastActiveSuperAdmin(user.id)) {
      return back({ error: "At least one active Super Admin must remain." });
    }
    if (role.key === "super_admin" || previousRole?.key === "super_admin") {
      const problem = reauthenticate(req);
      if (problem) return back({ error: problem });
    }

    state.userRoles = state.userRoles.filter((ur) => ur.user_id !== user.id);
    state.userRoles.push({
      id: nextId("userRoles"),
      user_id: user.id,
      role_id: role.id,
      assigned_at: now(),
      assigned_by: actorId,
    });
    user.role = role.key;
    user.updated_at = now();
    // Permission changes take effect immediately for the target user.
    authz.revokeSessions(user.id);
    persist();
    audit(req, "USER_ROLE_CHANGED", {
      targetType: "user",
      targetId: user.id,
      previous: { role: previousRole?.key || null },
      next: { role: role.key },
    });
    back({ notice: `Role updated to ${role.name}. Active sessions were revoked.` });
  });

  app.post(`${R}/settings/users/:id/status`, ...guard, csrf, authz.requirePermission("users.disable"), (req, res) => {
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    const back = (params) => redirectWith(res, `${R}/settings/users/${user.id}`, params);
    const status = String(req.body.status || "");
    if (!USER_STATUSES.includes(status)) return back({ error: "Invalid status." });
    if (!authz.canManageUser(req.session.user.id, user)) {
      return authz.forbidden(req, res, "You cannot modify this account.");
    }
    if (status !== "active" && authz.isLastActiveSuperAdmin(user.id)) {
      audit(req, "USER_STATUS_CHANGE", { targetType: "user", targetId: user.id, result: "failure", detail: "Last Super Admin protected" });
      return back({ error: "At least one active Super Admin must remain active." });
    }
    const problem = reauthenticate(req);
    if (problem) return back({ error: problem });

    const previous = user.status;
    user.status = status;
    user.is_active = status === "active" ? 1 : 0;
    user.updated_at = now();
    if (status !== "active") authz.revokeSessions(user.id);
    persist();
    audit(req, status === "active" ? "USER_ENABLED" : "USER_DISABLED", {
      targetType: "user",
      targetId: user.id,
      previous: { status: previous },
      next: { status },
    });
    back({ notice: `Status changed to ${status}.` });
  });

  app.post(`${R}/settings/users/:id/force-logout`, ...guard, csrf, authz.requirePermission("users.update"), (req, res) => {
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    if (!authz.canManageUser(req.session.user.id, user)) {
      return authz.forbidden(req, res, "You cannot modify this account.");
    }
    authz.revokeSessions(user.id);
    audit(req, "USER_FORCED_LOGOUT", { targetType: "user", targetId: user.id });
    redirectWith(res, `${R}/settings/users/${user.id}`, { notice: "All sessions revoked." });
  });

  app.post(`${R}/settings/users/:id/reset-password`, ...guard, csrf, authz.requirePermission("users.reset_password"), (req, res) => {
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    if (!authz.canManageUser(req.session.user.id, user)) {
      return authz.forbidden(req, res, "You cannot modify this account.");
    }
    const temporary = randomPassword();
    user.password_hash = bcrypt.hashSync(temporary, 12);
    user.must_change_password = 1;
    user.password_changed_at = now();
    user.updated_at = now();
    authz.revokeSessions(user.id);
    persist();
    audit(req, "PASSWORD_RESET_INITIATED", { targetType: "user", targetId: user.id });
    sendMail({
      to: user.email,
      subject: "Your Onairo Portal password was reset",
      text: `Hello,\n\nYour portal password was reset.\n\nTemporary password: ${temporary}\n\nYou will be asked to choose a new password at next sign in.`,
    }).catch(() => {});
    redirectWith(res, `${R}/settings/users/${user.id}`, { notice: `Temporary password: ${temporary}` });
  });

  app.post(`${R}/settings/users/:id/delete`, ...guard, csrf, authz.requirePermission("users.delete"), (req, res) => {
    const actorId = req.session.user.id;
    const user = authz.userById(req.params.id);
    if (!user) return res.status(404).send("Not found");
    const back = (params) => redirectWith(res, `${R}/settings/users/${user.id}`, params);
    if (!authz.canManageUser(actorId, user)) return authz.forbidden(req, res, "You cannot delete this account.");
    if (authz.isLastActiveSuperAdmin(user.id)) {
      audit(req, "USER_DELETE", { targetType: "user", targetId: user.id, result: "failure", detail: "Last Super Admin protected" });
      return back({ error: "The final active Super Admin cannot be deleted." });
    }
    const problem = reauthenticate(req);
    if (problem) return back({ error: problem });

    const snapshot = { email: user.email, role: primaryRole(user.id)?.key || null };
    state.users = state.users.filter((u) => u.id !== user.id);
    state.userRoles = state.userRoles.filter((ur) => ur.user_id !== user.id);
    state.invitations = state.invitations.filter((i) => i.user_id !== user.id);
    state.sessions = state.sessions.filter((s) => s.user_id !== user.id);
    persist();
    audit(req, "USER_DELETED", { targetType: "user", targetId: user.id, previous: snapshot });
    redirectWith(res, `${R}/settings/users`, { notice: `Deleted ${snapshot.email}.` });
  });

  /* ---------------------------------------------------------------- *
   * Roles & permissions
   * ---------------------------------------------------------------- */

  app.get(`${R}/settings/roles`, ...guard, authz.requirePermission("roles.view"), (req, res) => {
    const canCreate = authz.can(req, "roles.create");
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>Roles &amp; Permissions</strong><div class="muted"><a href="${R}/settings/users" style="text-decoration:underline">Back to Users</a></div></div>
        ${canCreate ? `<a class="btn primary" href="${R}/settings/roles/new">Create Role</a>` : ""}
      </div>
      <table class="stack">
        <thead><tr><th>Role</th><th>Description</th><th>Users</th><th>Permissions</th><th>Type</th><th>Actions</th></tr></thead>
        <tbody>${state.roles
          .slice()
          .sort((a, b) => (b.level || 0) - (a.level || 0))
          .map((role) => `<tr>
            <td data-label="Role"><strong>${esc(role.name)}</strong><div class="muted">level ${role.level}</div></td>
            <td data-label="Description" class="muted">${esc(role.description || "")}</td>
            <td data-label="Users">${usersInRole(role.id)}</td>
            <td data-label="Permissions">${permissionKeysForRole(role.id).length}</td>
            <td data-label="Type">${role.is_system ? '<span class="badge">System</span>' : '<span class="badge ok">Custom</span>'}</td>
            <td data-label="Actions"><span class="actions">
              <a class="btn sm" href="${R}/settings/roles/${role.id}">View</a>
              ${canCreate ? `<form method="post" action="${R}/settings/roles/${role.id}/duplicate">${csrfField}<button class="btn sm" type="submit">Duplicate</button></form>` : ""}
              ${!role.is_system && authz.can(req, "roles.delete") ? `<form method="post" action="${R}/settings/roles/${role.id}/delete" onsubmit="return confirm('Delete this role?')">${csrfField}<button class="btn sm danger" type="submit">Delete</button></form>` : ""}
            </span></td>
          </tr>`)
          .join("")}</tbody>
      </table>
      <p class="muted" style="margin-top:10px">System roles cannot be deleted. A role with assigned users must be emptied first.</p>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.get(`${R}/settings/roles/new`, ...guard, authz.requirePermission("roles.create"), (req, res) => {
    const actorId = req.session.user.id;
    const own = [...authz.permissionsOf(actorId)];
    const grantable = authz.isSuperAdmin(actorId) ? perms.ALL_PERMISSIONS : own;
    const lockedKeys = perms.ALL_PERMISSIONS.filter((p) => !grantable.includes(p));
    const maxLevel = authz.isSuperAdmin(actorId) ? perms.SUPER_ADMIN_LEVEL - 1 : authz.roleLevel(actorId) - 1;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head"><strong>Create Role</strong><a class="btn sm" href="${R}/settings/roles">Back</a></div>
      <form method="post" action="${R}/settings/roles">
        <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
        <div class="row2">
          <div class="row"><label>Role name *</label><input name="name" required></div>
          <div class="row"><label>Level (1–${maxLevel})</label><input type="number" name="level" min="1" max="${maxLevel}" value="${Math.max(1, Math.min(20, maxLevel))}"></div>
        </div>
        <div class="row"><label>Description</label><input name="description"></div>
        ${views.permissionMatrix({ modules: perms.MODULES, granted: [], lockedKeys })}
        <div class="row" style="margin-top:14px"><label>Confirm with your current password</label><input type="password" name="currentPassword" required></div>
        <button class="btn primary" type="submit">Create role</button>
      </form>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.post(`${R}/settings/roles`, ...guard, csrf, authz.requirePermission("roles.create"), (req, res) => {
    const actorId = req.session.user.id;
    const fail = (error) => redirectWith(res, `${R}/settings/roles/new`, { error });
    const name = String(req.body.name || "").trim();
    if (!name) return fail("Role name is required.");

    const problem = reauthenticate(req);
    if (problem) return fail(problem);

    const requested = [].concat(req.body.permissions || []).filter((p) => perms.ALL_PERMISSIONS.includes(p));
    const escalation = authz.canGrantPermissions(actorId, requested);
    if (!escalation.ok) {
      audit(req, "ROLE_CREATE", { targetType: "role", targetId: name, result: "failure", detail: `Escalation blocked: ${escalation.escalated.join(",")}` });
      return authz.forbidden(req, res, "You cannot grant permissions you do not hold yourself.");
    }
    const ceiling = authz.isSuperAdmin(actorId) ? perms.SUPER_ADMIN_LEVEL - 1 : authz.roleLevel(actorId) - 1;
    const level = Math.max(1, Math.min(Number(req.body.level) || 10, ceiling));
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `role_${Date.now()}`;
    if (state.roles.some((r) => r.key === key)) return fail("A role with a similar name already exists.");

    const role = {
      id: nextId("roles"),
      key,
      name,
      description: String(req.body.description || "").trim() || null,
      level,
      is_system: 0,
      created_by: actorId,
      created_at: now(),
      updated_at: now(),
    };
    state.roles.push(role);
    setRolePermissions(role.id, requested);
    persist();
    audit(req, "ROLE_CREATED", { targetType: "role", targetId: role.id, next: { key, level, permissions: requested.length } });
    redirectWith(res, `${R}/settings/roles/${role.id}`, { notice: "Role created." });
  });

  app.get(`${R}/settings/roles/:id`, ...guard, authz.requirePermission("roles.view"), (req, res) => {
    const actorId = req.session.user.id;
    const role = roleById(req.params.id);
    if (!role) return res.status(404).send("Not found");
    const editable = authz.can(req, "roles.update") && authz.canEditRole(actorId, role);
    const granted = permissionKeysForRole(role.id);
    const grantable = authz.isSuperAdmin(actorId) ? perms.ALL_PERMISSIONS : [...authz.permissionsOf(actorId)];
    const lockedKeys = perms.ALL_PERMISSIONS.filter((p) => !grantable.includes(p));
    const assigned = state.userRoles.filter((ur) => ur.role_id === role.id).map((ur) => authz.userById(ur.user_id)).filter(Boolean);

    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>${esc(role.name)}</strong><div class="muted">${esc(role.key)} • level ${role.level} • ${role.is_system ? "system role" : "custom role"} • ${granted.length} permissions</div></div>
        <a class="btn sm" href="${R}/settings/roles">Back</a>
      </div>
      ${role.key === "super_admin" ? `<div class="notice">Super Admin always holds every permission. This role is locked to prevent privilege changes to the highest authority.</div>` : ""}
      ${!editable && role.key !== "super_admin" ? `<div class="notice">You have read-only access to this role.</div>` : ""}
      <form method="post" action="${R}/settings/roles/${role.id}">
        <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
        <div class="row2">
          <div class="row"><label>Role name</label><input name="name" value="${esc(role.name)}" ${editable ? "" : "disabled"}></div>
          <div class="row"><label>Description</label><input name="description" value="${esc(role.description || "")}" ${editable ? "" : "disabled"}></div>
        </div>
        ${views.permissionMatrix({
          modules: perms.MODULES,
          granted,
          disabled: !editable,
          lockedKeys: editable ? lockedKeys : [],
        })}
        ${editable ? `<div class="row" style="margin-top:14px"><label>Confirm with your current password</label><input type="password" name="currentPassword" required></div>
        <button class="btn primary" type="submit">Save permissions</button>` : ""}
      </form>
    </div>
    <div class="panel">
      <strong>Assigned users (${assigned.length})</strong>
      <div class="perms" style="margin-top:10px">${assigned
        .map((u) => `<a class="badge" href="${R}/settings/users/${u.id}">${esc(u.full_name || u.email)}</a>`)
        .join("") || '<span class="muted">Nobody is assigned to this role.</span>'}</div>
    </div>`;
    res.send(portalShell("Users & Roles", inner, req));
  });

  app.post(`${R}/settings/roles/:id`, ...guard, csrf, authz.requirePermission("roles.update"), (req, res) => {
    const actorId = req.session.user.id;
    const role = roleById(req.params.id);
    if (!role) return res.status(404).send("Not found");
    const back = (params) => redirectWith(res, `${R}/settings/roles/${role.id}`, params);

    if (!authz.canEditRole(actorId, role)) {
      audit(req, "ROLE_UPDATE", { targetType: "role", targetId: role.id, result: "failure", detail: "Blocked by role authority" });
      return authz.forbidden(req, res, "You cannot modify this role.");
    }
    const problem = reauthenticate(req);
    if (problem) return back({ error: problem });

    const requested = [].concat(req.body.permissions || []).filter((p) => perms.ALL_PERMISSIONS.includes(p));
    const escalation = authz.canGrantPermissions(actorId, requested);
    if (!escalation.ok) {
      audit(req, "ROLE_UPDATE", { targetType: "role", targetId: role.id, result: "failure", detail: `Escalation blocked: ${escalation.escalated.join(",")}` });
      return authz.forbidden(req, res, "You cannot grant permissions you do not hold yourself.");
    }
    // Blocked: granting yourself more power by editing a role you hold.
    const holdsRole = state.userRoles.some((ur) => ur.user_id === Number(actorId) && ur.role_id === role.id);
    if (holdsRole && !authz.isSuperAdmin(actorId)) {
      const own = authz.permissionsOf(actorId);
      const added = requested.filter((p) => !own.has(p));
      if (added.length) {
        audit(req, "ROLE_UPDATE", { targetType: "role", targetId: role.id, result: "failure", detail: "Self escalation blocked" });
        return authz.forbidden(req, res, "You cannot add permissions to your own role.");
      }
    }

    const previous = permissionKeysForRole(role.id);
    role.name = String(req.body.name || role.name).trim();
    role.description = String(req.body.description || "").trim() || null;
    role.updated_at = now();
    // Stops boot-time re-sync from reverting this customization.
    role.permissions_customized = 1;
    setRolePermissions(role.id, requested);
    // Everyone holding this role gets the new permission set on next request.
    state.userRoles.filter((ur) => ur.role_id === role.id).forEach((ur) => authz.revokeSessions(ur.user_id));
    persist();
    audit(req, "ROLE_PERMISSIONS_CHANGED", {
      targetType: "role",
      targetId: role.id,
      previous: { permissions: previous },
      next: { permissions: requested },
    });
    back({ notice: "Permissions updated. Affected users must sign in again." });
  });

  app.post(`${R}/settings/roles/:id/duplicate`, ...guard, csrf, authz.requirePermission("roles.create"), (req, res) => {
    const actorId = req.session.user.id;
    const role = roleById(req.params.id);
    if (!role) return res.status(404).send("Not found");
    const source = permissionKeysForRole(role.id);
    const escalation = authz.canGrantPermissions(actorId, source);
    if (!escalation.ok) {
      return authz.forbidden(req, res, "You cannot duplicate a role containing permissions you do not hold.");
    }
    const ceiling = authz.isSuperAdmin(actorId) ? perms.SUPER_ADMIN_LEVEL - 1 : authz.roleLevel(actorId) - 1;
    const copy = {
      id: nextId("roles"),
      key: `${role.key}_copy_${Date.now().toString(36)}`,
      name: `${role.name} (copy)`,
      description: role.description,
      level: Math.max(1, Math.min(role.level, ceiling)),
      is_system: 0,
      created_by: actorId,
      created_at: now(),
      updated_at: now(),
    };
    state.roles.push(copy);
    setRolePermissions(copy.id, source);
    persist();
    audit(req, "ROLE_CREATED", { targetType: "role", targetId: copy.id, detail: `Duplicated from ${role.key}` });
    redirectWith(res, `${R}/settings/roles/${copy.id}`, { notice: "Role duplicated." });
  });

  app.post(`${R}/settings/roles/:id/delete`, ...guard, csrf, authz.requirePermission("roles.delete"), (req, res) => {
    const role = roleById(req.params.id);
    if (!role) return res.status(404).send("Not found");
    if (role.is_system) {
      audit(req, "ROLE_DELETE", { targetType: "role", targetId: role.id, result: "failure", detail: "System role" });
      return redirectWith(res, `${R}/settings/roles`, { error: "System roles cannot be deleted." });
    }
    const assigned = usersInRole(role.id);
    if (assigned > 0) {
      return redirectWith(res, `${R}/settings/roles`, {
        error: `Reassign the ${assigned} user(s) in this role before deleting it.`,
      });
    }
    state.roles = state.roles.filter((r) => r.id !== role.id);
    state.rolePermissions = state.rolePermissions.filter((rp) => rp.role_id !== role.id);
    persist();
    audit(req, "ROLE_DELETED", { targetType: "role", targetId: role.id, previous: { key: role.key } });
    redirectWith(res, `${R}/settings/roles`, { notice: "Role deleted." });
  });

  /* ---------------------------------------------------------------- *
   * Invitations (public, token-gated)
   * ---------------------------------------------------------------- */

  function findInvitation(rawToken) {
    const hash = hashToken(rawToken);
    return state.invitations.find((i) => i.token_hash === hash) || null;
  }

  function invitationProblem(invite) {
    if (!invite) return "This invitation link is not valid.";
    if (invite.status !== "pending" || invite.used_at) return "This invitation has already been used.";
    if (new Date(invite.expires_at).getTime() < Date.now()) return "This invitation has expired.";
    return null;
  }

  app.get(`${R}/invite/:token`, (req, res) => {
    const invite = findInvitation(req.params.token);
    const problem = invitationProblem(invite);
    const csrfToken = token(req);
    const send = () =>
      res.status(problem ? 400 : 200).send(
        views.standalone({
          portalRoute: R,
          title: "Accept invitation",
          heading: "Set your portal password",
          description: problem ? "" : "Choose a password to activate your Onairo Portal account.",
          error: problem || req.query.error,
          formHtml: problem
            ? `<a class="btn" href="${R}/login">Go to sign in</a>`
            : `<form method="post" action="${R}/invite/${esc(req.params.token)}">
              <input type="hidden" name="CSRFToken" value="${esc(csrfToken)}">
              <div class="row"><label>New password</label><input type="password" name="password" required autocomplete="new-password"></div>
              <div class="row"><label>Confirm password</label><input type="password" name="confirmPassword" required autocomplete="new-password"></div>
              <button class="btn primary" type="submit">Activate account</button>
            </form>`,
        })
      );
    // Persist CSRF token before the invitation form can be submitted.
    req.session.save((err) => {
      if (err) return res.status(500).send("Could not start invitation session.");
      send();
    });
  });

  app.post(`${R}/invite/:token`, csrf, (req, res) => {
    const invite = findInvitation(req.params.token);
    const problem = invitationProblem(invite);
    if (problem) {
      audit(req, "INVITATION_REJECTED", { targetType: "invitation", targetId: invite?.id ?? "unknown", result: "failure", detail: problem });
      return res.status(400).send(
        views.standalone({
          portalRoute: R,
          title: "Accept invitation",
          heading: "Invitation unavailable",
          error: problem,
          formHtml: `<a class="btn" href="${R}/login">Go to sign in</a>`,
        })
      );
    }
    const fail = (error) => redirectWith(res, `${R}/invite/${req.params.token}`, { error });
    if (req.body.password !== req.body.confirmPassword) return fail("Passwords do not match.");
    const invalid = validatePassword(req.body.password);
    if (invalid) return fail(invalid);

    const user = authz.userById(invite.user_id);
    if (!user) return fail("This invitation is no longer valid.");

    user.password_hash = bcrypt.hashSync(String(req.body.password), 12);
    user.status = "active";
    user.is_active = 1;
    user.must_change_password = 0;
    user.password_changed_at = now();
    user.updated_at = now();
    // Single use: the hash is cleared so the link can never be replayed.
    invite.status = "accepted";
    invite.used_at = now();
    invite.token_hash = null;
    persist();
    audit(req, "INVITATION_ACCEPTED", { targetType: "user", targetId: user.id, actorName: user.email });
    res.send(
      views.standalone({
        portalRoute: R,
        title: "Account activated",
        heading: "Account activated",
        notice: "Your password is set. You can now sign in.",
        formHtml: `<a class="btn primary" href="${R}/login">Go to sign in</a>`,
      })
    );
  });

  /* ---------------------------------------------------------------- *
   * Audit logs
   * ---------------------------------------------------------------- */

  app.get(`${R}/audit-logs`, ...guard, authz.requirePermission("audit_logs.view"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const perPage = 25;
    const page = Math.max(1, Number(req.query.page) || 1);
    let rows = state.auditLogs.slice().reverse();
    if (q) {
      rows = rows.filter((l) =>
        [l.action, l.actor_name, l.target_type, l.target_id, l.detail, l.result].join(" ").toLowerCase().includes(q)
      );
    }
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    const pageRows = rows.slice((page - 1) * perPage, page * perPage);
    const short = (value) => {
      if (value == null) return "—";
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return esc(text.length > 90 ? `${text.slice(0, 90)}…` : text);
    };
    const inner = `<div class="panel">
      <div class="panel-head"><div><strong>Audit Logs</strong><div class="muted">${rows.length} entries</div></div></div>
      <form class="toolbar" method="get"><input type="search" name="q" value="${esc(q)}" placeholder="Search action, actor, target"><button class="btn">Search</button></form>
      <table class="stack" style="margin-top:12px">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Before</th><th>After</th><th>Result</th></tr></thead>
        <tbody>${pageRows
          .map((l) => `<tr>
            <td data-label="Time">${esc(String(l.created_at).slice(0, 19).replace("T", " "))}</td>
            <td data-label="Actor">${esc(l.actor_name || "system")}</td>
            <td data-label="Action"><span class="badge">${esc(l.action)}</span></td>
            <td data-label="Target">${esc(l.target_type ? `${l.target_type}:${l.target_id}` : l.target || "—")}</td>
            <td data-label="Before" class="muted">${short(l.previous_value)}</td>
            <td data-label="After" class="muted">${short(l.new_value ?? l.detail)}</td>
            <td data-label="Result">${l.result === "failure" ? '<span class="badge off">failure</span>' : '<span class="badge ok">success</span>'}</td>
          </tr>`)
          .join("") || `<tr><td colspan="7" class="muted">No audit entries.</td></tr>`}
        </tbody>
      </table>
      <div class="pager">${Array.from({ length: Math.min(pages, 12) }, (_, i) => i + 1)
        .map((p) => (p === page ? `<span class="on">${p}</span>` : `<a href="?q=${encodeURIComponent(q)}&page=${p}">${p}</a>`))
        .join("")}<span class="muted">Page ${page} of ${pages}</span></div>
    </div>`;
    res.send(portalShell("Audit Logs", inner, req));
  });
};
