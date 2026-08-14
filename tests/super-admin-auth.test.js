/**
 * Multi-admin authentication: seeded Super Admin vs portal-created Super Admin,
 * invite pending trap, password reset activation, session persistence.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const db = require("../server/db");
const authz = require("../server/authz");

const SECOND_ADMIN_EMAIL = "second.super@onairo.test";
const SECOND_ADMIN_PASSWORD = "SecondAdmin123!";
const INVITE_ADMIN_EMAIL = "invite.super@onairo.test";

test.before(async () => {
  await h.start();
});

test.after(async () => {
  await h.stop();
});

test("existing Super Admin can log in and load /portal", async () => {
  const { client, res } = await h.login("root@onairo.test", "RootPassword123");
  assert.equal(res.status, 302);
  assert.match(String(res.location || ""), /\/portal/);
  const dash = await client.get("/portal");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Onairo Portal|Dashboard/i);
});

test("newly created Super Admin with temporary password can log in and stay authenticated", async () => {
  const { client: admin } = await h.login("root@onairo.test", "RootPassword123");
  await admin.get("/portal/settings/users/new");
  const create = await admin.post("/portal/settings/users", {
    fullName: "Second Super Admin",
    email: SECOND_ADMIN_EMAIL,
    roleId: String(db.findRole("super_admin").id),
    method: "temporary",
    temporaryPassword: SECOND_ADMIN_PASSWORD,
    status: "active",
    mustChangePassword: "on",
    currentPassword: "RootPassword123",
  });
  assert.equal(create.status, 302);
  assert.match(String(create.location || ""), /notice=/);

  const created = db.state.users.find((u) => u.email === SECOND_ADMIN_EMAIL);
  assert.ok(created, "second Super Admin should exist");
  assert.equal(created.status, "active");
  assert.equal(Number(created.is_active), 1);
  assert.equal(created.role, "super_admin");
  assert.ok(authz.isSuperAdmin(created.id));
  assert.ok(authz.permissionsOf(created.id).has("dashboard.view"));
  assert.ok(created.password_hash && !created.password_hash.includes(SECOND_ADMIN_PASSWORD));

  const { client: b, res: loginRes } = await h.login(SECOND_ADMIN_EMAIL, SECOND_ADMIN_PASSWORD);
  assert.equal(loginRes.status, 302);
  // must_change_password redirects to change-password first
  assert.match(String(loginRes.location || ""), /change-password|\/portal/);

  if (String(loginRes.location || "").includes("change-password")) {
    await b.get("/portal/change-password");
    const changed = await b.post("/portal/change-password", {
      currentPassword: SECOND_ADMIN_PASSWORD,
      newPassword: "SecondAdmin456!",
      confirmPassword: "SecondAdmin456!",
    });
    assert.equal(changed.status, 302);
  }

  const dash = await b.get("/portal");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Onairo Portal|Dashboard/i);

  const usersPage = await b.get("/portal/settings/users");
  assert.equal(usersPage.status, 200);
});

test("invite-created Super Admin cannot log in while pending", async () => {
  const { client: admin } = await h.login("root@onairo.test", "RootPassword123");
  await admin.get("/portal/settings/users/new");
  const create = await admin.post("/portal/settings/users", {
    fullName: "Invite Super",
    email: INVITE_ADMIN_EMAIL,
    roleId: String(db.findRole("super_admin").id),
    method: "invite",
    status: "active",
    currentPassword: "RootPassword123",
    sendWelcomeEmail: "on",
  });
  assert.equal(create.status, 302);

  const created = db.state.users.find((u) => u.email === INVITE_ADMIN_EMAIL);
  assert.ok(created);
  assert.equal(created.status, "pending");
  assert.equal(Number(created.is_active), 0);
  assert.equal(authz.isActive(created), false);

  // Invite accounts store a random unknown hash — login rejects before status messaging.
  const client = new h.Client();
  await client.get("/portal/login");
  const login = await client.post("/portal/login", {
    email: INVITE_ADMIN_EMAIL,
    password: "Anything123!",
  });
  assert.equal(login.status, 401);
  assert.match(login.text, /Invalid credentials|pending invitation|not active/i);
});

test("typed temporary password forces temporary method even if invite selected", async () => {
  const email = "forced.temp@onairo.test";
  const { client: admin } = await h.login("root@onairo.test", "RootPassword123");
  await admin.get("/portal/settings/users/new");
  const create = await admin.post("/portal/settings/users", {
    fullName: "Forced Temp",
    email,
    roleId: String(db.findRole("viewer").id),
    method: "invite",
    temporaryPassword: "ForcedTemp123!",
    status: "active",
  });
  assert.equal(create.status, 302);
  const created = db.state.users.find((u) => u.email === email);
  assert.ok(created);
  assert.equal(created.status, "active");
  assert.equal(Number(created.is_active), 1);

  const { client, res } = await h.login(email, "ForcedTemp123!");
  assert.equal(res.status, 302);
  const dash = await client.get("/portal");
  // viewer may lack dashboard.view depending on role — still authenticated
  assert.ok(dash.status === 200 || dash.status === 403);
  if (dash.status === 403) {
    // session is live if not redirected to login
    assert.doesNotMatch(dash.text, /Sign In/i);
  }
});

test("incorrect password and unknown email are rejected", async () => {
  const client = new h.Client();
  await client.get("/portal/login");
  const badPw = await client.post("/portal/login", {
    email: "root@onairo.test",
    password: "WrongPassword999!",
  });
  assert.equal(badPw.status, 401);
  assert.match(badPw.text, /Invalid credentials/i);

  const unknown = await client.post("/portal/login", {
    email: "nobody@onairo.test",
    password: "Password123!",
  });
  assert.equal(unknown.status, 401);
});

test("inactive user cannot log in", async () => {
  const user = h.createUser("inactive.user@onairo.test", "viewer", "Password123!", {
    status: "inactive",
    is_active: 0,
  });
  const client = new h.Client();
  await client.get("/portal/login");
  const res = await client.post("/portal/login", {
    email: user.email,
    password: "Password123!",
  });
  assert.equal(res.status, 401);
  assert.match(res.text, /not active/i);
});

test("password reset activates pending user and allows login", async () => {
  const email = "reset.pending@onairo.test";
  const pending = h.createUser(email, "viewer", "OldPassword123!", {
    status: "pending",
    is_active: 0,
  });
  const { client: admin } = await h.login("root@onairo.test", "RootPassword123");
  await admin.get(`/portal/settings/users/${pending.id}`);
  const reset = await admin.post(`/portal/settings/users/${pending.id}/reset-password`, {});
  assert.equal(reset.status, 302);
  assert.match(String(reset.location || ""), /Temporary|notice=/i);

  const updated = db.state.users.find((u) => u.id === pending.id);
  assert.equal(updated.status, "active");
  assert.equal(Number(updated.is_active), 1);

  const qs = new URL(String(reset.location || ""), "http://localhost").searchParams;
  const notice = qs.get("notice") || "";
  const match = notice.match(/Temporary password:\s*(\S+)/i);
  assert.ok(match, `reset notice should include temporary password, got: ${notice}`);
  const temp = match[1];

  const { res } = await h.login(email, temp);
  assert.equal(res.status, 302);
});

test("logout clears session and blocks portal", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  assert.equal((await client.get("/portal")).status, 200);
  await client.get("/portal");
  const out = await client.post("/portal/logout", {});
  assert.equal(out.status, 302);
  const again = await client.get("/portal");
  assert.ok(again.status === 302 || again.status === 401);
  if (again.status === 302) assert.match(String(again.location || ""), /login/);
});

test("unauthorized portal access redirects to login", async () => {
  const client = new h.Client();
  const res = await client.get("/portal");
  assert.equal(res.status, 302);
  assert.match(String(res.location || ""), /login/);
});

test("health and public routes remain available", async () => {
  const client = new h.Client();
  const health = await client.get("/health");
  assert.equal(health.status, 200);
  const login = await client.get("/portal/login");
  assert.equal(login.status, 200);
  const home = await client.get("/");
  assert.equal(home.status, 200);
  const showcase = await client.get("/showcase/carshowroom");
  assert.ok(showcase.status === 200 || showcase.status === 404);
  const popups = await client.get("/api/public/popups/active?page=/");
  assert.equal(popups.status, 200);
});

test("portal markup includes mobile drawer controls", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const dash = await client.get("/portal");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /id="drawerBtn"/);
  assert.match(dash.text, /id="scrim"/);
  assert.match(dash.text, /id="side"/);
  assert.match(dash.text, /aria-controls="side"/);
  assert.match(dash.text, /drawer-open/);
});
