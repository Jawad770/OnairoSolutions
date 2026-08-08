#!/usr/bin/env node
/**
 * Ensure schemas exist, apply Prisma schema, seed system roles/permissions.
 * Does not create a Super Admin when one already exists.
 */
require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: true, env: process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

console.log("Applying Prisma schema...");
run("npx", ["prisma", "db", "push", "--skip-generate"]);

console.log("Seeding roles/permissions via portal migrate...");
const { initDb, seedAdminUser, migrate, prisma } = require("../../server/db");

(async () => {
  await initDb();
  await seedAdminUser();
  await migrate();
  console.log("Database initialized.");
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
