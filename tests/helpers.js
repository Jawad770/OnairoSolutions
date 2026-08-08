/**
 * Test harness: boots the real portal server against a throwaway PostgreSQL database.
 * Must be required before any server module so env overrides land before dotenv/config.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "onairo-portal-test-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://portal_user:onairo_portal_dev@127.0.0.1:5432/onairo_core_test";
process.env.DB_PATH = path.join(tmpDir, "onairo-data.json");
process.env.UPLOAD_DIR = path.join(tmpDir, "uploads");
process.env.SESSION_SECRET = "test-session-secret";
process.env.AUDIT_SALT = "test-audit-salt";
process.env.LOGIN_RATE_LIMIT_MAX = "500";
process.env.FORM_RATE_LIMIT_MAX = "500";
process.env.INIT_ADMIN_EMAIL = "root@onairo.test";
process.env.INIT_ADMIN_PASSWORD = "RootPassword123";

const bcrypt = require("bcryptjs");
const app = require("../server/main");
const db = require("../server/db");
const authz = require("../server/authz");

let server;
let baseUrl;

function start() {
  return app.ready().then(
    () =>
      new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          baseUrl = `http://127.0.0.1:${server.address().port}`;
          resolve(baseUrl);
        });
      })
  );
}

function stop() {
  return db
    .flush()
    .then(() => db.prisma.$disconnect())
    .catch(() => {})
    .then(
      () =>
        new Promise((resolve) => {
          if (server) server.close(resolve);
          else resolve();
        })
    );
}

/** Minimal cookie jar over fetch. */
class Client {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(res) {
    const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    raw.forEach((line) => {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    });
  }

  async request(method, urlPath, { body, json, headers = {} } = {}) {
    const init = { method, redirect: "manual", headers: { ...headers } };
    if (this.cookies.size) init.headers.Cookie = this.header();
    if (json) {
      init.headers["Content-Type"] = "application/json";
      init.headers["x-csrf-token"] = this.csrf || "";
      init.body = JSON.stringify(json);
    } else if (body) {
      init.headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = new URLSearchParams({ CSRFToken: this.csrf || "", ...body }).toString();
    }
    const res = await fetch(`${baseUrl}${urlPath}`, init);
    this.absorb(res);
    const text = await res.text();
    const token = text.match(/name="CSRFToken" value="([^"]+)"/);
    if (token) this.csrf = token[1];
    return { status: res.status, headers: res.headers, location: res.headers.get("location"), text };
  }

  get(urlPath, opts) {
    return this.request("GET", urlPath, opts);
  }

  post(urlPath, body, opts) {
    return this.request("POST", urlPath, { body, ...opts });
  }

  postJson(urlPath, json) {
    return this.request("POST", urlPath, { json });
  }
}

/** Creates an active user holding a single role, bypassing the UI. */
function createUser(email, roleKey, password = "Password123!", overrides = {}) {
  const role = db.findRole(roleKey);
  if (!role) throw new Error(`Unknown role ${roleKey}`);
  const ts = db.now();
  const user = {
    id: db.nextId("users"),
    email: email.toLowerCase(),
    full_name: email.split("@")[0],
    job_title: null,
    phone: null,
    avatar_url: null,
    password_hash: bcrypt.hashSync(password, 4),
    role: roleKey,
    status: "active",
    is_active: 1,
    must_change_password: 0,
    failed_logins: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: ts,
    sessions_revoked_at: null,
    created_by: null,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  };
  db.state.users.push(user);
  db.assignRole(user.id, role.id, null);
  db.persist();
  return user;
}

async function login(email, password = "Password123!") {
  const client = new Client();
  await client.get("/portal/login");
  const res = await client.post("/portal/login", { email, password });
  return { client, res };
}

function createLead(overrides = {}) {
  const lead = db.insertLead({
    sourceType: "contact",
    name: overrides.name || "Test Lead",
    email: overrides.email || "lead@example.com",
    projectDescription: "Test",
  });
  Object.assign(lead, overrides);
  db.persist();
  return lead;
}

function createTicket(overrides = {}) {
  const id = db.nextId("tickets");
  const ticket = {
    id,
    ticket_code: `TK-${String(id).padStart(6, "0")}`,
    subject: overrides.subject || "Test ticket",
    customer: null,
    description: null,
    priority: "Normal",
    status: "Open",
    assigned_user_id: null,
    assigned_at: null,
    assigned_by: null,
    created_by: null,
    created_at: db.now(),
    updated_at: db.now(),
    ...overrides,
  };
  db.state.tickets.push(ticket);
  db.persist();
  return ticket;
}

module.exports = { start, stop, Client, createUser, login, createLead, createTicket, db, authz, tmpDir, app };
