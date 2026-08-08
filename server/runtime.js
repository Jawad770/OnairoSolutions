/**
 * Runtime helpers: version, required dirs, startup validation.
 */
const fs = require("fs");
const path = require("path");

function readVersion(rootDir) {
  try {
    const fromFile = fs.readFileSync(path.join(rootDir, "VERSION"), "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    /* fall through */
  }
  try {
    const pkg = require(path.join(rootDir, "package.json"));
    return String(pkg.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function ensureRuntimeDirs(dirs) {
  for (const dir of dirs) {
    if (!dir) continue;
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Validate required env before the HTTP server binds.
 * Exits process with a friendly message on failure.
 */
function validateStartupEnv({ databaseUrl, sessionSecret, isProd }) {
  const missing = [];
  if (!databaseUrl || !String(databaseUrl).trim()) {
    missing.push("DATABASE_URL");
  }
  if (!sessionSecret || !String(sessionSecret).trim()) {
    missing.push("SESSION_SECRET");
  }
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error("");
    // eslint-disable-next-line no-console
    console.error("Cannot start Onairo Solutions — missing required configuration:");
    for (const key of missing) {
      // eslint-disable-next-line no-console
      console.error(`  • ${key}`);
    }
    // eslint-disable-next-line no-console
    console.error("");
    // eslint-disable-next-line no-console
    console.error("Copy .env.example to .env and set the values, then try again.");
    // eslint-disable-next-line no-console
    console.error("");
    process.exit(1);
  }
  if (isProd && (sessionSecret === "change-me-in-production" || sessionSecret === "change-this-to-a-long-random-secret")) {
    // eslint-disable-next-line no-console
    console.error("");
    // eslint-disable-next-line no-console
    console.error("Cannot start in production with a weak SESSION_SECRET.");
    // eslint-disable-next-line no-console
    console.error("Set a long random SESSION_SECRET in .env before deploying.");
    // eslint-disable-next-line no-console
    console.error("");
    process.exit(1);
  }
}

module.exports = {
  readVersion,
  ensureRuntimeDirs,
  validateStartupEnv,
};
