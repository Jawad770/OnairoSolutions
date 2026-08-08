require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("./config");
const store = require("./db/store");

fs.mkdirSync(config.uploadDir, { recursive: true });

function now() {
  return new Date().toISOString();
}

function hashIp(ip) {
  return crypto
    .createHmac("sha256", config.auditLogIpHashSalt)
    .update(ip || "unknown")
    .digest("hex");
}

const state = store.emptyState();

let persistChain = Promise.resolve();
let readyResolve;
let readyReject;
const ready = new Promise((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});

function persist() {
  persistChain = persistChain
    .then(() => store.saveState(state))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[db] persist failed:", err.message);
      throw err;
    });
  return persistChain;
}

async function flush() {
  try {
    await persistChain;
  } catch {
    /* last error already logged */
  }
}

async function initDb() {
  try {
    await store.pingDatabase();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "Database unavailable. Check DATABASE_URL and that PostgreSQL is running.\n",
      err.message
    );
    readyReject(err);
    throw err;
  }

  if (process.env.NODE_ENV === "test") {
    await prismaWipeForTests();
  }

  const loaded = await store.loadState();
  Object.keys(state).forEach((k) => {
    state[k] = loaded[k];
  });
  readyResolve();
  return state;
}

async function prismaWipeForTests() {
  await store.prisma.$transaction(async (tx) => {
    await store.wipePortalTables(tx);
  });
  Object.keys(state).forEach((k) => {
    if (k === "counters") state[k] = {};
    else state[k] = [];
  });
}

function nextId(key) {
  state.counters[key] = (state.counters[key] || 0) + 1;
  return state.counters[key];
}

function seedAdminUser() {
  const email = String(process.env.INIT_ADMIN_EMAIL || "admin@onairosolutions.com")
    .trim()
    .toLowerCase();
  const password = process.env.INIT_ADMIN_PASSWORD || "ChangeMeNow!123";
  const hashed = bcrypt.hashSync(password, 12);
  const ts = now();
  const existing = state.users.find((u) => String(u.email || "").toLowerCase() === email);

  if (existing) {
    // db:init must keep the configured admin usable (unlock + sync password from env).
    let changed = false;
    if (process.env.INIT_ADMIN_PASSWORD) {
      existing.password_hash = hashed;
      changed = true;
    }
    if (existing.status !== "active") {
      existing.status = "active";
      changed = true;
    }
    if (!existing.is_active) {
      existing.is_active = 1;
      changed = true;
    }
    if (existing.failed_logins || existing.locked_until) {
      existing.failed_logins = 0;
      existing.locked_until = null;
      changed = true;
    }
    if (changed) {
      existing.updated_at = ts;
      return persist();
    }
    return undefined;
  }

  if (state.users.length > 0) return undefined;

  state.users.push({
    id: nextId("users"),
    email,
    password_hash: hashed,
    role: "admin",
    is_active: 1,
    status: "active",
    failed_logins: 0,
    locked_until: null,
    last_login_at: null,
    must_change_password: 0,
    created_at: ts,
    updated_at: ts,
  });
  return persist();
}

function findRole(key) {
  return state.roles.find((r) => r.key === key);
}

function findPermission(key) {
  return state.permissions.find((p) => p.key === key);
}

function grantPermissions(roleId, keys) {
  keys.forEach((key) => {
    const permission = findPermission(key);
    if (!permission) return;
    const exists = state.rolePermissions.some((rp) => rp.role_id === roleId && rp.permission_id === permission.id);
    if (!exists) {
      state.rolePermissions.push({ id: nextId("rolePermissions"), role_id: roleId, permission_id: permission.id });
    }
  });
}

function setRolePermissions(roleId, keys) {
  state.rolePermissions = state.rolePermissions.filter((rp) => rp.role_id !== roleId);
  grantPermissions(roleId, keys);
}

function assignRole(userId, roleId, assignedBy = null) {
  const exists = state.userRoles.some((ur) => ur.user_id === userId && ur.role_id === roleId);
  if (exists) return;
  state.userRoles.push({
    id: nextId("userRoles"),
    user_id: userId,
    role_id: roleId,
    assigned_at: now(),
    assigned_by: assignedBy,
  });
}

function migrate() {
  const perms = require("./permissions");
  let changed = false;

  perms.ALL_PERMISSIONS.forEach((key) => {
    if (findPermission(key)) return;
    const [moduleKey, action] = key.split(".");
    state.permissions.push({
      id: nextId("permissions"),
      key,
      module: moduleKey,
      action,
      label: perms.PERMISSION_LABELS[key] || key,
    });
    changed = true;
  });

  perms.SYSTEM_ROLES.forEach((definition) => {
    let role = findRole(definition.key);
    const defined = perms.permissionsForRoleDefinition(definition);
    if (!role) {
      role = {
        id: nextId("roles"),
        key: definition.key,
        name: definition.name,
        description: definition.description,
        level: definition.level,
        is_system: 1,
        permissions_customized: 0,
        created_by: null,
        created_at: now(),
        updated_at: now(),
      };
      state.roles.push(role);
      setRolePermissions(role.id, defined);
      changed = true;
      return;
    }
    if (role.is_system !== 1 || role.level !== definition.level) {
      role.is_system = 1;
      role.level = definition.level;
      changed = true;
    }
    if (role.permissions_customized === undefined) {
      role.permissions_customized = 0;
      changed = true;
    }
    if (!role.permissions_customized) {
      const current = permissionKeysForRole(role.id).sort().join(",");
      if (current !== defined.slice().sort().join(",")) {
        setRolePermissions(role.id, defined);
        changed = true;
      }
    }
  });

  const superAdmin = findRole("super_admin");
  if (superAdmin) {
    const before = state.rolePermissions.filter((rp) => rp.role_id === superAdmin.id).length;
    grantPermissions(superAdmin.id, perms.ALL_PERMISSIONS);
    if (state.rolePermissions.filter((rp) => rp.role_id === superAdmin.id).length !== before) changed = true;
  }

  state.users.forEach((user) => {
    const defaults = {
      full_name: user.full_name || user.email.split("@")[0].replace(/[._-]+/g, " "),
      job_title: user.job_title ?? null,
      phone: user.phone ?? null,
      avatar_url: user.avatar_url ?? null,
      status: user.status || (user.is_active ? "active" : "disabled"),
      must_change_password: user.must_change_password ?? 0,
      password_changed_at: user.password_changed_at || user.created_at,
      sessions_revoked_at: user.sessions_revoked_at || null,
      created_by: user.created_by ?? null,
    };
    Object.entries(defaults).forEach(([key, value]) => {
      if (user[key] !== value) {
        user[key] = value;
        changed = true;
      }
    });
  });

  if (superAdmin) {
    const legacyAdmins = state.users.filter(
      (u) => !state.userRoles.some((ur) => ur.user_id === u.id) && (u.role === "admin" || u.role === "super_admin")
    );
    legacyAdmins.forEach((u) => {
      assignRole(u.id, superAdmin.id, null);
      u.role = "super_admin";
      changed = true;
    });
  }

  state.leads.forEach((lead) => {
    if (lead.assigned_user_id === undefined) {
      lead.assigned_user_id = lead.assigned_to_user_id ?? null;
      changed = true;
    }
    if (lead.assigned_at === undefined) {
      lead.assigned_at = null;
      changed = true;
    }
    if (lead.assigned_by === undefined) {
      lead.assigned_by = null;
      changed = true;
    }
    if (lead.whatsapp && /^0\d{10}$/.test(String(lead.whatsapp).replace(/\s+/g, ""))) {
      lead.whatsapp = `+92${String(lead.whatsapp).replace(/\D+/g, "").slice(1)}`;
      if (!lead.dial_code) lead.dial_code = "+92";
      if (!lead.country) lead.country = "Pakistan";
      changed = true;
    }
    if (lead.country === undefined) {
      lead.country = lead.country || null;
      lead.country_code = lead.country_code || null;
      lead.dial_code = lead.dial_code || null;
      lead.phone_number = lead.phone_number || null;
      changed = true;
    }
  });
  state.clients.forEach((client) => {
    if (client.assigned_user_id === undefined) {
      client.assigned_user_id = null;
      changed = true;
    }
  });

  if (changed) return persist();
  return Promise.resolve();
}

function permissionKeysForUser(userId) {
  const roleIds = state.userRoles.filter((ur) => ur.user_id === userId).map((ur) => ur.role_id);
  if (!roleIds.length) return new Set();
  const permissionIds = new Set(
    state.rolePermissions.filter((rp) => roleIds.includes(rp.role_id)).map((rp) => rp.permission_id)
  );
  const keys = new Set();
  state.permissions.forEach((p) => {
    if (permissionIds.has(p.id)) keys.add(p.key);
  });
  return keys;
}

function rolesForUser(userId) {
  const roleIds = state.userRoles.filter((ur) => ur.user_id === userId).map((ur) => ur.role_id);
  return state.roles.filter((r) => roleIds.includes(r.id));
}

function permissionKeysForRole(roleId) {
  const permissionIds = state.rolePermissions.filter((rp) => rp.role_id === roleId).map((rp) => rp.permission_id);
  return state.permissions.filter((p) => permissionIds.includes(p.id)).map((p) => p.key);
}

function createLeadCode(id) {
  return `LD-${String(id).padStart(6, "0")}`;
}

function insertLead(payload) {
  const ts = now();
  const id = nextId("leads");
  const leadCode = createLeadCode(id);
  const row = {
    id,
    lead_code: leadCode,
    source_type: payload.sourceType,
    source_ref_id: payload.sourceRefId || null,
    date_created: ts,
    name: payload.name,
    business: payload.business || null,
    industry: payload.industry || null,
    service_product: payload.serviceProduct || null,
    email: payload.email || null,
    whatsapp: payload.whatsapp || null,
    phone: payload.phone || null,
    country: payload.country || null,
    country_code: payload.countryCode || payload.country_code || null,
    dial_code: payload.dialCode || payload.dial_code || null,
    phone_number: payload.phoneNumber || payload.phone_number || null,
    city: payload.city || null,
    budget: payload.budget || null,
    timeline: payload.timeline || null,
    preferred_contact_method: payload.preferredContactMethod || null,
    project_description: payload.projectDescription || null,
    status: payload.status || "New",
    assigned_to_user_id: null,
    assigned_user_id: null,
    assigned_at: null,
    assigned_by: null,
    website_url: payload.websiteUrl || null,
    metadata_json: payload.metadataJson || null,
  };
  state.leads.push(row);
  persist();
  return row;
}

module.exports = {
  state,
  persist,
  nextId,
  initDb,
  seedAdminUser,
  now,
  hashIp,
  insertLead,
  migrate,
  findRole,
  findPermission,
  grantPermissions,
  setRolePermissions,
  assignRole,
  permissionKeysForUser,
  permissionKeysForRole,
  rolesForUser,
  ready,
  flush,
  prisma: store.prisma,
};
