#!/usr/bin/env node
/**
 * One-time (or re-runnable) import of data/onairo-data.json into onairo_core.
 * After a successful import the JSON file is renamed to onairo-data.backup.json.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const store = require("../../server/db/store");

const ROOT = path.resolve(__dirname, "../..");
const jsonPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(ROOT, "data", "onairo-data.json");
const backupPath = path.join(path.dirname(jsonPath), "onairo-data.backup.json");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!fs.existsSync(jsonPath)) {
    if (fs.existsSync(backupPath)) {
      console.log("JSON already migrated (backup present). Skipping.");
      return;
    }
    throw new Error(`JSON datastore not found: ${jsonPath}`);
  }

  await store.pingDatabase();
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const state = store.emptyState();
  Object.keys(state).forEach((k) => {
    if (parsed[k] !== undefined) state[k] = parsed[k];
  });

  console.log("Importing collections:");
  Object.keys(state).forEach((k) => {
    const v = state[k];
    const n = Array.isArray(v) ? v.length : typeof v === "object" ? Object.keys(v).length : 0;
    console.log(`  ${k}: ${n}`);
  });

  await store.saveState(state);
  console.log("PostgreSQL import complete.");

  if (fs.existsSync(backupPath)) {
    const stamped = backupPath.replace(/\.backup\.json$/, `.backup.${Date.now()}.json`);
    fs.renameSync(backupPath, stamped);
    console.log(`Previous backup moved to ${path.basename(stamped)}`);
  }
  fs.renameSync(jsonPath, backupPath);
  console.log(`Renamed ${path.basename(jsonPath)} -> ${path.basename(backupPath)}`);
}

main()
  .then(() => store.prisma.$disconnect())
  .catch(async (err) => {
    console.error("Migration failed:", err);
    await store.prisma.$disconnect();
    process.exit(1);
  });
