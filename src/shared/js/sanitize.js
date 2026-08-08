/**
 * Public HTML/URL sanitization (browser).
 */
(function (global) {
  const ONAIRO = (global.ONAIRO = global.ONAIRO || {});

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

  function safeUrl(value, fallback) {
    if (value == null || value === "") return fallback == null ? "" : fallback;
    const raw = String(value).trim();
    if (!raw) return fallback == null ? "" : fallback;
    const lower = raw.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("blob:") ||
      lower.startsWith("file:")
    ) {
      return fallback == null ? "" : fallback;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      if (!/^https?:\/\//i.test(raw)) return fallback == null ? "" : fallback;
      try {
        const u = new URL(raw);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return fallback == null ? "" : fallback;
        }
        return u.toString();
      } catch (_e) {
        return fallback == null ? "" : fallback;
      }
    }
    if (raw.startsWith("//")) return fallback == null ? "" : fallback;
    if (/^[/?#.]/.test(raw) || /^[A-Za-z0-9_\-./?#%=&]+$/.test(raw)) return raw;
    return fallback == null ? "" : fallback;
  }

  function safeColor(value, fallback) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return fallback || "";
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) return raw;
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(raw)) {
      return raw;
    }
    return fallback || "";
  }

  ONAIRO.escapeHtml = escapeHtml;
  ONAIRO.escapeAttr = escapeAttr;
  ONAIRO.safeUrl = safeUrl;
  ONAIRO.safeColor = safeColor;
})(typeof window !== "undefined" ? window : globalThis);
