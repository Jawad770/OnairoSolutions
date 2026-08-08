/**
 * Shared HTML/URL sanitization for public responses and SSR strings.
 */

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/**
 * Allow only http(s) absolute URLs or safe relative paths.
 * Rejects javascript:, data:, vbscript:, and other schemes.
 */
function safeUrl(value, { allowEmpty = true } = {}) {
  if (value == null) return allowEmpty ? "" : null;
  const raw = String(value).trim();
  if (!raw) return allowEmpty ? "" : null;
  const lower = raw.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^https?:\/\//i.test(raw)) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  }
  // Relative / root-relative / hash / query only
  if (raw.startsWith("//")) return null;
  if (/^[/?#.]/.test(raw) || /^[A-Za-z0-9_\-./?#%=&]+$/.test(raw)) return raw;
  return null;
}

function safeColor(value, fallback = "") {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return fallback;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return raw;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(raw)) {
    return raw;
  }
  return fallback;
}

module.exports = { escapeHtml, escapeAttr, safeUrl, safeColor };
