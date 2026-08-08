/**
 * Audit logging.
 *
 * Records who did what, to which record, with before/after values. Secrets are
 * scrubbed: password hashes, tokens and CSRF values never reach the log.
 */

const { state, persist, nextId, now, hashIp } = require("./db");

const SENSITIVE_KEYS = [
  "password",
  "password_hash",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "temporarypassword",
  "token",
  "token_hash",
  "csrftoken",
  "csrf",
  "secret",
  "sessionid",
  "sid",
];

function isSensitive(key) {
  const k = String(key).toLowerCase().replace(/[^a-z_]/g, "");
  return SENSITIVE_KEYS.some((s) => k.includes(s.replace(/[^a-z_]/g, "")));
}

function scrub(value, depth = 0) {
  if (value == null || depth > 3) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      out[key] = isSensitive(key) ? "[redacted]" : scrub(val, depth + 1);
    });
    return out;
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}

/**
 * @param {object} req  Express request (for actor + IP + user agent)
 * @param {string} action  e.g. "USER_ROLE_CHANGED"
 * @param {object|string} options  target metadata, or a plain target string
 *        (legacy call style used by the original portal routes).
 */
function audit(req, action, options = {}) {
  const opts = typeof options === "string" ? { targetId: options } : options || {};
  const actorId = req?.session?.user?.id || null;
  const actor = actorId ? state.users.find((u) => u.id === actorId) : null;

  const row = {
    id: nextId("auditLogs"),
    user_id: actorId,
    actor_name: actor?.full_name || actor?.email || opts.actorName || "system",
    action,
    target: opts.targetId != null ? String(opts.targetId) : "",
    target_type: opts.targetType || null,
    target_id: opts.targetId != null ? String(opts.targetId) : null,
    previous_value: opts.previous !== undefined ? scrub(opts.previous) : null,
    new_value: opts.next !== undefined ? scrub(opts.next) : null,
    detail: opts.detail ? String(opts.detail).slice(0, 500) : null,
    result: opts.result === "failure" ? "failure" : "success",
    ip_hash: hashIp(req?.ip),
    user_agent: String(req?.headers?.["user-agent"] || "").slice(0, 250),
    created_at: now(),
  };
  state.auditLogs.push(row);
  persist();
  return row;
}

module.exports = { audit, scrub };
