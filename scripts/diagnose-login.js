#!/usr/bin/env node
/**
 * Diagnostic: boots the portal in-process and reports which login check rejects
 * the configured Super Admin. Read-only: it never writes to the database.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./../server/db");
const authz = require("./../server/authz");
const config = require("./../server/config");

const email = (process.argv[2] || process.env.INIT_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.argv[3] || process.env.INIT_ADMIN_PASSWORD || "";

(async () => {
  await db.initDb();
  const user = db.state.users.find((u) => u.email === email);

  const report = {
    lookupEmail: email,
    passwordLength: password.length,
    usersInMemory: db.state.users.length,
    emailsInMemory: db.state.users.map((u) => u.email),
    userFound: Boolean(user),
  };

  if (user) {
    const locked = Boolean(user.locked_until && new Date(user.locked_until).getTime() > Date.now());
    report.status = user.status;
    report.isActive = user.is_active;
    report.failedLogins = user.failed_logins;
    report.lockedUntil = user.locked_until;
    report.locked = locked;
    report.passwordMatches = Boolean(user.password_hash) && bcrypt.compareSync(password, user.password_hash);
    report.passesActiveCheck = authz.isActive(user);
    report.roles = db.rolesForUser ? db.rolesForUser(user.id).map((r) => r.key) : undefined;
    report.mustChangePassword = user.must_change_password;
    report.maxLoginFailures = config.maxLoginFailures;

    report.verdict = !report.passwordMatches
      ? "REJECTED: password hash does not match"
      : locked
        ? "REJECTED: account temporarily locked"
        : !report.passesActiveCheck
          ? `REJECTED: account status is ${user.status}`
          : "WOULD SUCCEED";
  } else {
    report.verdict = "REJECTED: no user with that email in loaded state";
  }

  console.log(JSON.stringify(report, null, 2));
  await db.prisma.$disconnect();
})().catch(async (err) => {
  console.error(err.message);
  try {
    await db.prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
