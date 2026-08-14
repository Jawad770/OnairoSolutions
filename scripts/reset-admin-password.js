/**
 * Reset (or create) a portal Super Admin password using the app hashing path.
 * Usage: node scripts/reset-admin-password.js [email]
 */
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../server/db");
const authz = require("../server/authz");

const EMAIL = String(process.argv[2] || "admin@onairosolutions.com")
  .trim()
  .toLowerCase();

function randomPassword() {
  return `On${crypto.randomBytes(6).toString("hex")}!${crypto.randomInt(10, 99)}`;
}

(async () => {
  await db.initDb();
  await db.seedAdminUser();
  await db.migrate();

  const temporary = randomPassword();
  const hashed = bcrypt.hashSync(temporary, 12);
  const ts = db.now();
  let user = db.state.users.find((u) => String(u.email || "").toLowerCase() === EMAIL);
  let created = false;

  const superRole = db.findRole("super_admin");
  if (!superRole) {
    console.error("SUPER_ADMIN_ROLE_MISSING");
    process.exit(1);
  }

  if (!user) {
    created = true;
    user = {
      id: db.nextId("users"),
      email: EMAIL,
      full_name: "Onairo Admin",
      job_title: null,
      phone: null,
      avatar_url: null,
      password_hash: hashed,
      role: "super_admin",
      status: "active",
      is_active: 1,
      must_change_password: 1,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      password_changed_at: ts,
      sessions_revoked_at: null,
      created_by: null,
      created_at: ts,
      updated_at: ts,
    };
    db.state.users.push(user);
    db.assignRole(user.id, superRole.id, null);
  } else {
    user.password_hash = hashed;
    user.status = "active";
    user.is_active = 1;
    user.must_change_password = 1;
    user.failed_logins = 0;
    user.locked_until = null;
    user.password_changed_at = ts;
    user.updated_at = ts;
    user.role = user.role || "super_admin";
    const hasSuper = db.state.userRoles.some(
      (ur) => ur.user_id === user.id && ur.role_id === superRole.id
    );
    if (!hasSuper) db.assignRole(user.id, superRole.id, null);
    authz.revokeSessions(user.id);
  }

  await db.persist();

  console.log(created ? "CREATED_OK" : "RESET_OK");
  console.log("USER_ID=" + user.id);
  console.log("EMAIL=" + user.email);
  console.log("STATUS=" + user.status);
  console.log("TEMP_PASSWORD=" + temporary);
  await db.prisma.$disconnect();
})().catch(async (err) => {
  console.error("RESET_FAILED", err.message || err);
  try {
    await db.prisma.$disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
