#!/usr/bin/env node
/**
 * Create a timestamped pg_dump backup of onairo_core.
 * Usage: npm run db:backup
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const backupDir = path.join(ROOT, "backups");
fs.mkdirSync(backupDir, { recursive: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(backupDir, `onairo_core_${stamp}.sql`);

const result = spawnSync(
  "pg_dump",
  [url, "--no-owner", "--no-acl", "-f", outFile],
  { encoding: "utf8", shell: true }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "pg_dump failed");
  process.exit(result.status || 1);
}

fs.writeFileSync(path.join(backupDir, "latest.txt"), path.basename(outFile), "utf8");
console.log(`Backup written: ${outFile}`);
