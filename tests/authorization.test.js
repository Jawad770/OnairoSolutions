const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const h = require("./helpers");
const { db } = h;

/** Reads the `error`/`notice` message out of a redirect Location header. */
function message(location) {
  const query = String(location).split("?")[1] || "";
  const params = new URLSearchParams(query);
  return params.get("error") || params.get("notice") || "";
}

const users = {};
let unassignedLead;
let executiveLead;
let agentTicket;
let otherTicket;

test.before(async () => {
  await h.start();
  users.superAdmin = db.state.users.find((u) => u.email === "root@onairo.test");
  users.salesManager = h.createUser("sales.manager@onairo.test", "sales_manager");
  users.salesExecutive = h.createUser("sales.exec@onairo.test", "sales_executive");
  users.otherExecutive = h.createUser("sales.exec2@onairo.test", "sales_executive");
  users.supportManager = h.createUser("support.manager@onairo.test", "support_manager");
  users.supportAgent = h.createUser("support.agent@onairo.test", "support_agent");
  users.otherAgent = h.createUser("support.agent2@onairo.test", "support_agent");
  users.contentManager = h.createUser("content@onairo.test", "content_manager");
  users.financeManager = h.createUser("finance@onairo.test", "finance_manager");
  users.viewer = h.createUser("viewer@onairo.test", "viewer");
  users.disabled = h.createUser("disabled@onairo.test", "sales_manager", "Password123!", {
    status: "disabled",
    is_active: 0,
  });
  users.suspended = h.createUser("suspended@onairo.test", "viewer", "Password123!", { status: "suspended" });

  unassignedLead = h.createLead({ name: "Unassigned Lead" });
  executiveLead = h.createLead({ name: "Executive Lead", assigned_user_id: users.salesExecutive.id });
  agentTicket = h.createTicket({ subject: "Agent ticket", assigned_user_id: users.supportAgent.id });
  otherTicket = h.createTicket({ subject: "Other agent ticket", assigned_user_id: users.otherAgent.id });
});

test.after(async () => {
  await h.stop();
});

/* ------------------------------------------------------------------ *
 * Authentication boundaries
 * ------------------------------------------------------------------ */

test("unauthenticated API request returns 401", async () => {
  const client = new h.Client();
  const res = await client.postJson(`/portal/api/leads/${unassignedLead.id}/status`, { status: "Won" });
  assert.equal(res.status, 401);
});

test("unauthenticated portal page redirects to login", async () => {
  const client = new h.Client();
  const res = await client.get("/portal/settings/users");
  assert.equal(res.status, 302);
  assert.match(res.location, /\/portal\/login/);
});

test("root super admin signs in and reaches the dashboard", async () => {
  const { client, res } = await h.login("root@onairo.test", "RootPassword123");
  assert.equal(res.status, 302);
  assert.equal(res.location, "/portal");
  const dash = await client.get("/portal");
  assert.equal(dash.status, 200);
});

test("existing CRM data survives the role migration", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const crm = await client.get("/portal/crm");
  assert.equal(crm.status, 200);
  assert.match(crm.text, /Unassigned Lead/);
  assert.match(crm.text, /Executive Lead/);
});

test("disabled user cannot log in", async () => {
  const { res } = await h.login("disabled@onairo.test");
  assert.equal(res.status, 401);
  assert.match(res.text, /not active/i);
});

test("suspended user cannot log in", async () => {
  const { res } = await h.login("suspended@onairo.test");
  assert.equal(res.status, 401);
});

test("disabling a signed-in user revokes their live session", async () => {
  const victim = h.createUser("revoke.me@onairo.test", "sales_manager");
  const { client } = await h.login("revoke.me@onairo.test");
  assert.equal((await client.get("/portal/crm")).status, 200);

  victim.status = "disabled";
  victim.is_active = 0;
  h.authz.revokeSessions(victim.id);

  const after = await client.get("/portal/crm");
  assert.equal(after.status, 302);
  assert.match(after.location, /\/portal\/login/);
});

/* ------------------------------------------------------------------ *
 * Role capability matrix
 * ------------------------------------------------------------------ */

test("super admin has full access", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  for (const path of [
    "/portal",
    "/portal/crm",
    "/portal/settings/users",
    "/portal/settings/roles",
    "/portal/audit-logs",
    "/portal/invoices",
    "/portal/support",
    "/portal/blog",
    "/portal/portfolio",
  ]) {
    assert.equal((await client.get(path)).status, 200, `expected 200 for ${path}`);
  }
});

test("sales manager can manage leads but not users or audit logs", async () => {
  const { client } = await h.login("sales.manager@onairo.test");
  assert.equal((await client.get("/portal/crm")).status, 200);
  assert.equal((await client.get("/portal/crm/export/csv")).status, 200);
  assert.equal((await client.get(`/portal/crm/${unassignedLead.id}`)).status, 200);
  assert.equal((await client.get("/portal/settings/users")).status, 403);
  assert.equal((await client.get("/portal/settings/roles")).status, 403);
  assert.equal((await client.get("/portal/audit-logs")).status, 403);
  assert.equal((await client.get("/portal/settings")).status, 403);
});

test("sales manager can change a lead status", async () => {
  const { client } = await h.login("sales.manager@onairo.test");
  await client.get("/portal/crm");
  const res = await client.postJson(`/portal/api/leads/${unassignedLead.id}/status`, { status: "Contacted" });
  assert.equal(res.status, 200);
  assert.equal(db.state.leads.find((l) => l.id === unassignedLead.id).status, "Contacted");
});

test("sales executive only sees leads assigned to them", async () => {
  const { client } = await h.login("sales.exec@onairo.test");
  const list = await client.get("/portal/crm");
  assert.equal(list.status, 200);
  assert.match(list.text, /Executive Lead/);
  assert.doesNotMatch(list.text, /Unassigned Lead/);

  assert.equal((await client.get(`/portal/crm/${executiveLead.id}`)).status, 200);
  assert.equal((await client.get(`/portal/crm/${unassignedLead.id}`)).status, 403);
});

test("sales executive cannot export CRM data or reach user management", async () => {
  const { client } = await h.login("sales.exec@onairo.test");
  assert.equal((await client.get("/portal/crm/export/csv")).status, 403);
  assert.equal((await client.get("/portal/settings/users")).status, 403);
  assert.equal((await client.get("/portal/audit-logs")).status, 403);
});

test("sales executive cannot change status of another executive's lead", async () => {
  const { client } = await h.login("sales.exec@onairo.test");
  await client.get("/portal/crm");
  const res = await client.postJson(`/portal/api/leads/${unassignedLead.id}/status`, { status: "Won" });
  assert.equal(res.status, 403);
});

test("support agent only sees tickets assigned to them", async () => {
  const { client } = await h.login("support.agent@onairo.test");
  const list = await client.get("/portal/support");
  assert.equal(list.status, 200);
  assert.match(list.text, /Agent ticket/);
  assert.doesNotMatch(list.text, /Other agent ticket/);

  assert.equal((await client.get(`/portal/support/${agentTicket.id}`)).status, 200);
  assert.equal((await client.get(`/portal/support/${otherTicket.id}`)).status, 403);
});

test("support agent cannot access CRM leads or sales analytics", async () => {
  const { client } = await h.login("support.agent@onairo.test");
  assert.equal((await client.get("/portal/crm")).status, 403);
  assert.equal((await client.get("/portal/analytics")).status, 403);
});

test("support manager sees every ticket", async () => {
  const { client } = await h.login("support.manager@onairo.test");
  const list = await client.get("/portal/support");
  assert.match(list.text, /Agent ticket/);
  assert.match(list.text, /Other agent ticket/);
  assert.equal((await client.get("/portal/settings/users")).status, 403);
});

test("content manager cannot access CRM but can manage content", async () => {
  const { client } = await h.login("content@onairo.test");
  assert.equal((await client.get("/portal/crm")).status, 403);
  assert.equal((await client.get(`/portal/crm/${unassignedLead.id}`)).status, 403);
  assert.equal((await client.get("/portal/invoices")).status, 403);
  assert.equal((await client.get("/portal/blog")).status, 200);
  assert.equal((await client.get("/portal/portfolio")).status, 200);
});

test("content manager cannot publish without the publish permission", async () => {
  const { client } = await h.login("content@onairo.test");
  const page = await client.get("/portal/blog");
  const created = await client.post("/portal/blog", { title: "Draft article" });
  assert.equal(created.status, 302);
  const post = db.state.blogPosts.find((p) => p.title === "Draft article");
  assert.equal(post.status, "Draft");
  assert.ok(page.status === 200);

  const denied = await client.post(`/portal/blog/${post.id}/status`, { status: "Published" });
  assert.equal(denied.status, 403);
  assert.equal(db.state.blogPosts.find((p) => p.id === post.id).status, "Draft");

  const allowed = await client.post(`/portal/blog/${post.id}/status`, { status: "In Review" });
  assert.equal(allowed.status, 302);
  assert.equal(db.state.blogPosts.find((p) => p.id === post.id).status, "In Review");
});

test("super admin can publish content that a content manager submitted", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const post = db.state.blogPosts.find((p) => p.title === "Draft article");
  await client.get("/portal/blog");
  const res = await client.post(`/portal/blog/${post.id}/status`, { status: "Published" });
  assert.equal(res.status, 302);
  assert.equal(db.state.blogPosts.find((p) => p.id === post.id).status, "Published");
});

test("finance manager works invoices but cannot reach security settings", async () => {
  const { client } = await h.login("finance@onairo.test");
  assert.equal((await client.get("/portal/invoices")).status, 200);
  assert.equal((await client.get("/portal/settings")).status, 403);
  assert.equal((await client.get("/portal/settings/users")).status, 403);
  assert.equal((await client.get("/portal/settings/roles")).status, 403);
  assert.equal((await client.get("/portal/audit-logs")).status, 403);
  assert.equal((await client.get("/portal/crm")).status, 403);

  const created = await client.post("/portal/invoices", { clientName: "Acme Ltd", amount: "50000", currency: "PKR" });
  assert.equal(created.status, 302);
  assert.ok(db.state.invoices.some((i) => i.client_name === "Acme Ltd"));
});

test("viewer is read-only", async () => {
  const { client } = await h.login("viewer@onairo.test");
  assert.equal((await client.get("/portal/crm")).status, 200);
  await client.get("/portal/crm");

  const status = await client.postJson(`/portal/api/leads/${unassignedLead.id}/status`, { status: "Won" });
  assert.equal(status.status, 403);

  const note = await client.post(`/portal/crm/${unassignedLead.id}/note`, { note: "should fail" });
  assert.equal(note.status, 403);

  assert.equal((await client.get("/portal/crm/export/csv")).status, 403);
  assert.equal((await client.get("/portal/settings/users")).status, 403);
});

test("sidebar only lists modules the role can reach", async () => {
  const cases = [
    ["sales.exec@onairo.test", ["My Leads", "Clients"], ["Users &amp; Roles", "Invoices", "Audit Logs", "Analytics"]],
    ["support.agent@onairo.test", ["My Tickets", "Clients"], ["CRM", "Invoices", "Users &amp; Roles"]],
    ["content@onairo.test", ["Blog", "Portfolio"], ["CRM", "My Leads", "Invoices", "Users &amp; Roles"]],
    ["finance@onairo.test", ["Invoices", "Clients", "Analytics"], ["CRM", "Blog", "Users &amp; Roles", "Settings"]],
  ];
  for (const [email, expected, forbidden] of cases) {
    const { client } = await h.login(email);
    const dash = await client.get("/portal");
    const sidebar = dash.text.split('<main class="main">')[0];
    expected.forEach((label) => assert.match(sidebar, new RegExp(`>${label}<`), `${email} should see ${label}`));
    forbidden.forEach((label) => assert.doesNotMatch(sidebar, new RegExp(`>${label}<`), `${email} should not see ${label}`));
  }
});

test("a revoked session cannot change the account password", async () => {
  const user = h.createUser("revoked.pw@onairo.test", "viewer");
  const { client } = await h.login("revoked.pw@onairo.test");
  assert.equal((await client.get("/portal/change-password")).status, 200);

  h.authz.revokeSessions(user.id);
  const after = await client.get("/portal/change-password");
  assert.equal(after.status, 302);
  assert.match(after.location, /\/portal\/login/);
});

test("hidden navigation still fails on the backend", async () => {
  const { client } = await h.login("content@onairo.test");
  const dash = await client.get("/portal");
  // Nav is filtered for usability...
  assert.doesNotMatch(dash.text, /href="\/portal\/settings\/users"/);
  // ...and the route itself refuses the request.
  assert.equal((await client.get("/portal/settings/users")).status, 403);
});

/* ------------------------------------------------------------------ *
 * Privilege escalation
 * ------------------------------------------------------------------ */

test("user cannot change roles through request tampering", async () => {
  const { client } = await h.login("sales.exec@onairo.test");
  await client.get("/portal/crm");
  const superRole = db.findRole("super_admin");
  const res = await client.post(`/portal/settings/users/${users.salesExecutive.id}/role`, {
    roleId: String(superRole.id),
    currentPassword: "Password123!",
  });
  assert.equal(res.status, 403);
  assert.equal(db.state.users.find((u) => u.id === users.salesExecutive.id).role, "sales_executive");
});

test("user cannot create accounts without users.create", async () => {
  const { client } = await h.login("sales.manager@onairo.test");
  await client.get("/portal/crm");
  const res = await client.post("/portal/settings/users", {
    fullName: "Sneaky Admin",
    email: "sneaky@onairo.test",
    roleId: String(db.findRole("super_admin").id),
    method: "temporary",
    temporaryPassword: "Password123!",
  });
  assert.equal(res.status, 403);
  assert.equal(db.state.users.some((u) => u.email === "sneaky@onairo.test"), false);
});

test("a delegated admin cannot grant permissions they do not hold", async () => {
  // Custom role with role management but no audit log access.
  const delegated = {
    id: db.nextId("roles"),
    key: "delegated_admin",
    name: "Delegated Admin",
    description: "Manages roles but has no audit access",
    level: 70,
    is_system: 0,
    created_by: null,
    created_at: db.now(),
    updated_at: db.now(),
  };
  db.state.roles.push(delegated);
  db.setRolePermissions(delegated.id, ["dashboard.view", "roles.view", "roles.update", "roles.create"]);
  const custom = {
    id: db.nextId("roles"),
    key: "custom_target",
    name: "Custom Target",
    description: null,
    level: 20,
    is_system: 0,
    created_by: null,
    created_at: db.now(),
    updated_at: db.now(),
  };
  db.state.roles.push(custom);
  db.setRolePermissions(custom.id, ["dashboard.view"]);
  h.createUser("delegated@onairo.test", "delegated_admin");
  db.persist();

  const { client } = await h.login("delegated@onairo.test");
  await client.get("/portal/settings/roles");
  const res = await client.post(`/portal/settings/roles/${custom.id}`, {
    name: "Custom Target",
    permissions: "audit_logs.view",
    currentPassword: "Password123!",
  });
  assert.equal(res.status, 403);
  assert.equal(db.permissionKeysForRole(custom.id).includes("audit_logs.view"), false);
});

test("the Super Admin role itself cannot be edited", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const superRole = db.findRole("super_admin");
  await client.get("/portal/settings/roles");
  const res = await client.post(`/portal/settings/roles/${superRole.id}`, {
    name: "Super Admin",
    permissions: "dashboard.view",
    currentPassword: "RootPassword123",
  });
  assert.equal(res.status, 403);
  assert.ok(db.permissionKeysForRole(superRole.id).length > 50);
});

test("sensitive actions require the current password", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  await client.get(`/portal/settings/users/${users.viewer.id}`);
  const res = await client.post(`/portal/settings/users/${users.viewer.id}/status`, {
    status: "disabled",
    currentPassword: "wrong-password",
  });
  assert.equal(res.status, 302);
  assert.match(res.location, /error=/);
  assert.equal(db.state.users.find((u) => u.id === users.viewer.id).status, "active");
});

test("the final active Super Admin cannot be disabled or demoted", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  await client.get(`/portal/settings/users/${users.superAdmin.id}`);

  const disable = await client.post(`/portal/settings/users/${users.superAdmin.id}/status`, {
    status: "disabled",
    currentPassword: "RootPassword123",
  });
  assert.equal(disable.status, 302);
  assert.match(message(disable.location), /Super Admin must remain/i);
  assert.equal(db.state.users.find((u) => u.id === users.superAdmin.id).status, "active");

  const demote = await client.post(`/portal/settings/users/${users.superAdmin.id}/role`, {
    roleId: String(db.findRole("viewer").id),
    currentPassword: "RootPassword123",
  });
  assert.equal(demote.status, 302);
  assert.match(message(demote.location), /Super Admin must remain/i);
  assert.equal(db.state.users.find((u) => u.id === users.superAdmin.id).role, "super_admin");

  const remove = await client.post(`/portal/settings/users/${users.superAdmin.id}/delete`, {
    currentPassword: "RootPassword123",
  });
  assert.equal(remove.status, 302);
  assert.match(message(remove.location), /cannot be deleted/i);
  assert.ok(db.state.users.some((u) => u.id === users.superAdmin.id));
});

/* ------------------------------------------------------------------ *
 * Users, roles, invitations
 * ------------------------------------------------------------------ */

test("super admin can create a user for every default role", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const roleKeys = [
    "sales_manager",
    "sales_executive",
    "support_manager",
    "support_agent",
    "content_manager",
    "finance_manager",
    "viewer",
  ];
  for (const key of roleKeys) {
    const role = db.findRole(key);
    await client.get("/portal/settings/users/new");
    const res = await client.post("/portal/settings/users", {
      fullName: `Test ${key}`,
      email: `test.${key}@onairo.test`,
      roleId: String(role.id),
      method: "temporary",
      temporaryPassword: "Password123!",
      status: "active",
    });
    assert.equal(res.status, 302, `create failed for ${key}`);
    const created = db.state.users.find((u) => u.email === `test.${key}@onairo.test`);
    assert.ok(created, `user missing for ${key}`);
    assert.equal(created.role, key);
  }
});

test("a role with assigned users cannot be deleted", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const custom = db.findRole("custom_target");
  db.assignRole(users.viewer.id, custom.id, null);
  db.persist();
  await client.get("/portal/settings/roles");
  const res = await client.post(`/portal/settings/roles/${custom.id}/delete`, {});
  assert.equal(res.status, 302);
  assert.match(message(res.location), /Reassign/i);
  assert.ok(db.findRole("custom_target"));

  db.state.userRoles = db.state.userRoles.filter((ur) => !(ur.user_id === users.viewer.id && ur.role_id === custom.id));
  db.persist();
});

test("system roles cannot be deleted", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  await client.get("/portal/settings/roles");
  const res = await client.post(`/portal/settings/roles/${db.findRole("viewer").id}/delete`, {});
  assert.equal(res.status, 302);
  assert.match(message(res.location), /System roles cannot be deleted/i);
  assert.ok(db.findRole("viewer"));
});

test("expired invitation is rejected", async () => {
  const user = h.createUser("expired.invite@onairo.test", "viewer", "Password123!", { status: "pending", is_active: 0 });
  const raw = crypto.randomBytes(32).toString("hex");
  db.state.invitations.push({
    id: db.nextId("invitations"),
    user_id: user.id,
    email: user.email,
    role_id: db.findRole("viewer").id,
    token_hash: crypto.createHash("sha256").update(raw).digest("hex"),
    status: "pending",
    expires_at: new Date(Date.now() - 1000).toISOString(),
    used_at: null,
    created_by: null,
    created_at: db.now(),
  });
  db.persist();

  const client = new h.Client();
  const page = await client.get(`/portal/invite/${raw}`);
  assert.equal(page.status, 400);
  assert.match(page.text, /expired/i);

  // The rejected page carries no CSRF token, so pick one up from the login page
  // to prove the rejection comes from invitation validation, not CSRF.
  await client.get("/portal/login");
  const submit = await client.post(`/portal/invite/${raw}`, { password: "BrandNew123", confirmPassword: "BrandNew123" });
  assert.equal(submit.status, 400);
  assert.match(submit.text, /expired/i);
  assert.equal(db.state.users.find((u) => u.id === user.id).status, "pending");
});

test("invitation is single use", async () => {
  const user = h.createUser("fresh.invite@onairo.test", "viewer", "Password123!", { status: "pending", is_active: 0 });
  const raw = crypto.randomBytes(32).toString("hex");
  db.state.invitations.push({
    id: db.nextId("invitations"),
    user_id: user.id,
    email: user.email,
    role_id: db.findRole("viewer").id,
    token_hash: crypto.createHash("sha256").update(raw).digest("hex"),
    status: "pending",
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    used_at: null,
    created_by: null,
    created_at: db.now(),
  });
  db.persist();

  const client = new h.Client();
  await client.get(`/portal/invite/${raw}`);
  const accept = await client.post(`/portal/invite/${raw}`, {
    password: "BrandNew123",
    confirmPassword: "BrandNew123",
  });
  assert.equal(accept.status, 200);
  assert.equal(db.state.users.find((u) => u.id === user.id).status, "active");

  const login = await h.login("fresh.invite@onairo.test", "BrandNew123");
  assert.equal(login.res.status, 302);

  const replay = await client.post(`/portal/invite/${raw}`, {
    password: "AnotherOne123",
    confirmPassword: "AnotherOne123",
  });
  assert.equal(replay.status, 400);
  assert.match(replay.text, /not valid|already been used/i);
});

test("permission changes take effect on the next request", async () => {
  const { client } = await h.login("viewer@onairo.test");
  assert.equal((await client.get("/portal/crm/export/csv")).status, 403);

  const viewerRole = db.findRole("viewer");
  const current = db.permissionKeysForRole(viewerRole.id);
  db.setRolePermissions(viewerRole.id, [...current, "leads.export"]);
  db.persist();

  assert.equal((await client.get("/portal/crm/export/csv")).status, 200);

  db.setRolePermissions(viewerRole.id, current);
  db.persist();
  assert.equal((await client.get("/portal/crm/export/csv")).status, 403);
});

test("forced password change blocks the rest of the portal", async () => {
  const user = h.createUser("mustchange@onairo.test", "sales_manager", "Password123!", { must_change_password: 1 });
  const { client, res } = await h.login("mustchange@onairo.test");
  assert.equal(res.location, "/portal/change-password");
  const blocked = await client.get("/portal/crm");
  assert.equal(blocked.status, 302);
  assert.equal(blocked.location, "/portal/change-password");

  await client.get("/portal/change-password");
  const changed = await client.post("/portal/change-password", {
    currentPassword: "Password123!",
    newPassword: "FreshPassword123",
    confirmPassword: "FreshPassword123",
  });
  assert.equal(changed.status, 302);
  assert.equal(db.state.users.find((u) => u.id === user.id).must_change_password, 0);
  assert.equal((await client.get("/portal/crm")).status, 200);
});

/* ------------------------------------------------------------------ *
 * Audit logging
 * ------------------------------------------------------------------ */

test("audit logs capture authorization failures and admin actions", async () => {
  const actions = db.state.auditLogs.map((l) => l.action);
  assert.ok(actions.includes("AUTH_LOGIN"), "login should be audited");
  assert.ok(actions.includes("AUTHZ_DENIED"), "denied requests should be audited");
  assert.ok(actions.includes("USER_CREATED"), "user creation should be audited");
  assert.ok(actions.includes("INVITATION_ACCEPTED"), "invitation acceptance should be audited");
  assert.ok(actions.includes("LEAD_STATUS_CHANGED"), "lead status changes should be audited");

  const denial = db.state.auditLogs.find((l) => l.action === "AUTHZ_DENIED");
  assert.equal(denial.result, "failure");
  assert.ok(denial.ip_hash && denial.ip_hash.length === 64, "IP should be stored hashed");

  const created = db.state.auditLogs.find((l) => l.action === "USER_CREATED");
  assert.ok(created.actor_name, "actor name recorded");
  assert.ok(created.target_type === "user" && created.target_id, "target recorded");
});

test("audit logs never store secrets", async () => {
  const serialized = JSON.stringify(db.state.auditLogs);
  assert.doesNotMatch(serialized, /\$2[aby]\$/, "no bcrypt hashes in audit log");
  assert.doesNotMatch(serialized, /"password"\s*:\s*"(?!\[redacted\])/, "no plain passwords");
  assert.doesNotMatch(serialized, /RootPassword123|Password123!/, "no credentials in audit log");
});
