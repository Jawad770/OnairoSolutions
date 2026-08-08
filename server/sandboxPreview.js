/**
 * Sandbox preview resolution — cookie / header gate for public APIs.
 * Live visitors without a valid token never receive sandbox overlays.
 */
const { SandboxRepository: sandbox } = require("./db/repositories/sandbox");

const COOKIE = "onairo_sbx";

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

async function resolveSandboxContext(req) {
  const token =
    String(req.headers["x-sandbox-token"] || "").trim() ||
    String(req.query.sandbox || "").trim() ||
    readCookie(req, COOKIE);
  if (!token) return null;
  const row = await sandbox.resolvePreviewToken(token);
  if (!row?.session) return null;
  return {
    token,
    sessionId: row.sessionId,
    session: row.session,
    changes: row.session.changes || [],
  };
}

function setSandboxCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSandboxCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

module.exports = {
  COOKIE,
  resolveSandboxContext,
  setSandboxCookie,
  clearSandboxCookie,
  readCookie,
};
