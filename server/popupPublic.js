/**
 * Public promotional popups API (read-only).
 */
const rateLimit = require("express-rate-limit");
const { MarketingPopupRepository: popups } = require("./db/repositories/marketingPopups");

function publicDto(row) {
  return {
    id: row.id,
    title: row.title || null,
    description: row.description || null,
    imageUrl: row.imageUrl || null,
    buttonText: row.buttonText || null,
    buttonUrl: row.buttonUrl || null,
    displayFrequency: row.displayFrequency || "once_per_session",
    delayMs: typeof row.delayMs === "number" ? row.delayMs : 800,
    targetPages: row.targetPages || "homepage_only",
    priority: typeof row.priority === "number" ? row.priority : 100,
  };
}

function registerPopupPublicApi(app) {
  const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/public/popups/active", limiter, async (req, res) => {
    try {
      const pagePath = String(req.query.page || req.query.path || "/");
      const rows = await popups.listActive({ pagePath });
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      res.json({
        ok: true,
        popup: rows[0] ? publicDto(rows[0]) : null,
        popups: rows.map(publicDto),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[popups api]", err?.message || err);
      res.status(500).json({ ok: false, error: "Could not load popups", popup: null, popups: [] });
    }
  });
}

module.exports = { registerPopupPublicApi, publicDto };
