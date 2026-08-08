#!/usr/bin/env node
/**
 * Restore the latest (or named) SQL backup into DATABASE_URL.
 * Usage: npm run db:restore
 *        node scripts/db/restore.js backups/onairo_core_....sql
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const backupDir = path.join(ROOT, "backups");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

let target = process.argv[2];
if (!target) {
  const latest = path.join(backupDir, "latest.txt");
  if (!fs.existsSync(latest)) {
    console.error("No latest backup. Pass a .sql file path.");
    process.exit(1);
  }
  target = path.join(backupDir, fs.readFileSync(latest, "utf8").trim());
}
target = path.resolve(target);
if (!fs.existsSync(target)) {
  console.error(`Backup not found: ${target}`);
  process.exit(1);
}

console.log(`Restoring ${target} ...`);
const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", target], {
  encoding: "utf8",
  shell: true,
});
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "psql restore failed");
  process.exit(result.status || 1);
}
console.log("Restore complete.");
