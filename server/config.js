const path = require("path");
const { readVersion, ensureRuntimeDirs, validateStartupEnv } = require("./runtime");

function bool(value, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const ROOT = path.resolve(__dirname, "..");
const isProd = (process.env.NODE_ENV || "development") === "production";
const sessionSecret = process.env.SESSION_SECRET || "";
const databaseUrl = process.env.DATABASE_URL || "";

validateStartupEnv({ databaseUrl, sessionSecret, isProd });

const publicDirectory = process.env.PUBLIC_DIRECTORY
  ? path.resolve(process.env.PUBLIC_DIRECTORY)
  : path.join(ROOT, "public");

/* Physical showcase HTML lives under public/demos (or DEMO_DIRECTORY / SHOWCASE_DIRECTORY). */
const showcaseDirectory = process.env.SHOWCASE_DIRECTORY
  ? path.resolve(process.env.SHOWCASE_DIRECTORY)
  : process.env.DEMO_DIRECTORY
    ? path.resolve(process.env.DEMO_DIRECTORY)
    : path.join(publicDirectory, "demos");

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, "data", "uploads");

const backupsDir = process.env.BACKUPS_DIR
  ? path.resolve(process.env.BACKUPS_DIR)
  : path.join(ROOT, "backups");

const logsDir = process.env.LOGS_DIR
  ? path.resolve(process.env.LOGS_DIR)
  : path.join(ROOT, "logs");

ensureRuntimeDirs([
  uploadDir,
  backupsDir,
  logsDir,
  path.join(ROOT, "data"),
  path.join(publicDirectory, "downloads"),
]);

const version = readVersion(ROOT);

/** Fixed public installer path — never include a version in the URL. */
const edutrackInstallerPath = path.join(publicDirectory, "downloads", "EduTrack-Setup.exe");
const edutrackInstallerUrl = "/downloads/EduTrack-Setup.exe";

module.exports = {
  env: process.env.NODE_ENV || "development",
  rootDir: ROOT,
  publicDirectory,
  /** @deprecated use showcaseDirectory — kept for compatibility */
  demoDirectory: showcaseDirectory,
  showcaseDirectory,
  edutrackInstallerPath,
  edutrackInstallerUrl,
  isProd,
  version,
  port: Number(process.env.PORT || 3000),
  portalRoute: process.env.PORTAL_ROUTE || "/portal",
  dbPath: process.env.DB_PATH || path.join(ROOT, "data", "onairo-data.json"),
  databaseUrl,
  sessionSecret,
  sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES || 60),
  rememberMeDays: Number(process.env.REMEMBER_ME_DAYS || 14),
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES || 20),
  maxLoginFailures: Number(process.env.MAX_LOGIN_FAILURES || 5),
  inviteExpiryHours: Number(process.env.INVITE_EXPIRY_HOURS || 72),
  minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH || 10),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 20),
  formRateLimitMax: Number(process.env.FORM_RATE_LIMIT_MAX || 30),
  uploadDir,
  backupsDir,
  logsDir,
  auditLogIpHashSalt: process.env.AUDIT_SALT || "audit-salt-change-me",
  trustProxy: bool(process.env.TRUST_PROXY, false),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "hello@onairosolutions.com",
  },
  ai: {
    enabled: bool(process.env.AI_ENABLED, true),
    /** Active provider: gemini (default) | openai | claude | local */
    provider: String(process.env.AI_PROVIDER || "gemini").toLowerCase().trim(),
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    rateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX || 40),
    maxMessageLength: Number(process.env.AI_MAX_MESSAGE_LENGTH || 2000),
    maxMessagesPerConversation: Number(process.env.AI_MAX_MESSAGES || 40),
    retentionDays: Number(process.env.AI_CONVERSATION_RETENTION_DAYS || 30),
  },
};
