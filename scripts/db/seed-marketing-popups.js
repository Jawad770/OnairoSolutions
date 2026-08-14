#!/usr/bin/env node
/**
 * Seed / upsert the Pakistan Independence Day 2026 promotional popup.
 * Copies packaged artwork into UPLOAD_DIR/popups and upserts by internal name.
 *
 * Safe to re-run: updates the same popup by name without creating duplicates.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const ASSET = path.join(ROOT, "assets", "popups", "independence-day-2026.png");
const NAME = "Pakistan Independence Day 2026";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const config = require("../../server/config");
  const { MarketingPopupRepository: popups } = require("../../server/db/repositories/marketingPopups");
  const { prisma } = require("../../server/db/prisma");

  const destDir = path.join(config.uploadDir, "popups");
  fs.mkdirSync(destDir, { recursive: true });
  const destFile = path.join(destDir, "independence-day-2026.png");

  if (!fs.existsSync(ASSET)) {
    console.error("Missing seed artwork:", ASSET);
    process.exit(1);
  }
  fs.copyFileSync(ASSET, destFile);
  console.log("Image ready:", destFile);

  const now = new Date();
  const year = now.getFullYear();
  // Window: Aug 13 00:00 → Aug 15 23:59 Asia/Karachi approximated as UTC+5
  const startAt = new Date(Date.UTC(year, 7, 12, 19, 0, 0)); // Aug 13 00:00 PKT
  const endAt = new Date(Date.UTC(year, 7, 15, 18, 59, 59)); // Aug 15 23:59 PKT

  const row = await popups.upsertByName(NAME, {
    // Artwork already contains the holiday headline — keep CMS title empty by default.
    title: null,
    description: null,
    imageUrl: "/uploads/popups/independence-day-2026.png",
    buttonText: "Talk to Onairo",
    buttonUrl: "/pages/contact.html",
    enabled: true,
    startAt,
    endAt,
    displayFrequency: "once_per_session",
    delayMs: 900,
    targetPages: "homepage_only",
    priority: 10,
  });

  console.log("Popup upserted:", row.id, row.name, "enabled=", row.enabled);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    const { prisma } = require("../../server/db/prisma");
    await prisma.$disconnect();
  } catch (_e) {
    /* ignore */
  }
  process.exit(1);
});
