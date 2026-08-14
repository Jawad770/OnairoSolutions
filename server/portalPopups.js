/**
 * Marketing → Popups — portal CMS for promotional modals.
 */
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const authz = require("./authz");
const { MarketingPopupRepository: popups } = require("./db/repositories/marketingPopups");
const { zonedLocalToUtc, utcToZonedLocalInput, DEFAULT_TZ } = require("./shared/timezone");

const { esc } = views;
const R = config.portalRoute;
const guard = [authz.requireAuth, authz.requireActiveUser];

const FREQUENCIES = [
  ["once_per_session", "Once per session"],
  ["once_per_day", "Once per day"],
  ["always", "Always (every visit)"],
];
const TARGETS = [
  ["homepage_only", "Homepage only"],
  ["entire_website", "Entire public website"],
];

const popupUploadDir = path.join(config.uploadDir, "popups");
fs.mkdirSync(popupUploadDir, { recursive: true });

const ALLOWED_MIME = /^(image\/(png|jpeg|jpg|webp|gif))$/i;
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(popupUploadDir, { recursive: true });
    cb(null, popupUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
    const safeExt = ALLOWED_EXT.has(ext) ? ext : ".png";
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok = ALLOWED_MIME.test(file.mimetype || "") && ALLOWED_EXT.has(ext);
    cb(ok ? null : new Error("Only PNG, JPEG, WebP, or GIF images are allowed"), ok);
  },
});

function flash(req) {
  return (
    (req.query.notice ? `<div class="notice">${esc(req.query.notice)}</div>` : "") +
    (req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : "")
  );
}

function redirectWith(res, pathName, params) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${pathName}${qs ? `?${qs}` : ""}`);
}

function bool(v) {
  return v === "on" || v === "true" || v === true || v === "1";
}

function numOr(v, fallback) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(v) {
  if (!v) return null;
  return zonedLocalToUtc(v, DEFAULT_TZ);
}

function toLocal(d) {
  return d ? utcToZonedLocalInput(d, DEFAULT_TZ) : "";
}

function statusBadge(status) {
  const map = { active: "ok", scheduled: "", expired: "warn", draft: "", deleted: "off" };
  return `<span class="badge ${map[status] || ""}">${esc(status || "")}</span>`;
}

function safePublicUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }
  if (value.startsWith("/")) {
    if (value.includes("..") || value.startsWith("//")) return null;
    return value.slice(0, 500);
  }
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch (_e) {
    return null;
  }
}

function validateBody(body, { requireName = true } = {}) {
  const name = String(body.name || "").trim().slice(0, 120);
  if (requireName && !name) throw new Error("Internal name is required");
  const title = String(body.title || "").trim().slice(0, 160) || null;
  const description = String(body.description || "").trim().slice(0, 2000) || null;
  const buttonText = String(body.buttonText || "").trim().slice(0, 80) || null;
  const buttonUrl = safePublicUrl(body.buttonUrl);
  if (String(body.buttonUrl || "").trim() && !buttonUrl) {
    throw new Error("Button URL must be a safe http(s) or site-relative path");
  }
  let imageUrl = String(body.imageUrl || "").trim() || null;
  if (imageUrl) {
    imageUrl = safePublicUrl(imageUrl);
    if (!imageUrl) throw new Error("Image URL is invalid");
  }
  const displayFrequency = String(body.displayFrequency || "once_per_session");
  if (!popups.FREQUENCIES.has(displayFrequency)) throw new Error("Invalid display frequency");
  const targetPages = String(body.targetPages || "homepage_only");
  if (!popups.TARGETS.has(targetPages)) throw new Error("Invalid target pages");
  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);
  if (startAt && endAt && endAt < startAt) throw new Error("End date must be after start date");
  return {
    name,
    title,
    description,
    imageUrl,
    buttonText,
    buttonUrl,
    enabled: bool(body.enabled),
    startAt,
    endAt,
    displayFrequency,
    delayMs: numOr(body.delayMs, 800),
    targetPages,
    priority: numOr(body.priority, 100),
  };
}

function previewCard(p) {
  const img = p.imageUrl
    ? `<img src="${esc(p.imageUrl)}" alt="" style="width:100%;max-height:320px;object-fit:contain;border-radius:12px;background:#0f172a0a">`
    : `<div class="muted" style="padding:40px;text-align:center;border:1px dashed rgba(0,0,0,.12);border-radius:12px">No image</div>`;
  return `<div class="panel" id="popupPreview">
    <strong>Preview</strong>
    <div style="margin-top:12px">${img}</div>
    <div style="margin-top:12px">
      <div style="font-weight:700;font-size:18px">${esc(p.title || p.name || "Title")}</div>
      <p class="muted" style="margin:8px 0 0">${esc(p.description || "")}</p>
      ${p.buttonText ? `<a class="btn primary sm" style="margin-top:12px" href="${esc(p.buttonUrl || "#")}">${esc(p.buttonText)}</a>` : ""}
    </div>
  </div>`;
}

function formFields(p, csrfField) {
  return `${csrfField}
    <h3 style="margin:0 0 8px">Basic</h3>
    <div class="row"><label>Internal name</label><input name="name" value="${esc(p.name || "")}" required maxlength="120"></div>
    <div class="row"><label>Title (optional — artwork may already include headline)</label><input name="title" value="${esc(p.title || "")}" maxlength="160"></div>
    <div class="row"><label>Description</label><textarea name="description" maxlength="2000">${esc(p.description || "")}</textarea></div>
    <div class="row"><label>Image URL</label><input name="imageUrl" id="imageUrlField" value="${esc(p.imageUrl || "")}" placeholder="/uploads/popups/…"></div>
    <div class="row2">
      <div class="row"><label>Button text</label><input name="buttonText" value="${esc(p.buttonText || "")}" maxlength="80"></div>
      <div class="row"><label>Button URL</label><input name="buttonUrl" value="${esc(p.buttonUrl || "")}" placeholder="/pages/contact.html or https://…"></div>
    </div>
    <h3 style="margin-top:16px">Scheduling</h3>
    <div class="row2">
      <div class="row"><label>Start</label><input type="datetime-local" name="startAt" value="${toLocal(p.startAt)}"></div>
      <div class="row"><label>End</label><input type="datetime-local" name="endAt" value="${toLocal(p.endAt)}"></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input style="width:auto" type="checkbox" name="enabled" ${p.enabled ? "checked" : ""}> Enabled (visible on public site when in date window)</label>
    <h3 style="margin-top:16px">Display</h3>
    <div class="row2">
      <div class="row"><label>Target pages</label><select name="targetPages">${TARGETS.map(
        ([v, label]) => `<option value="${v}" ${p.targetPages === v ? "selected" : ""}>${label}</option>`
      ).join("")}</select></div>
      <div class="row"><label>Display frequency</label><select name="displayFrequency">${FREQUENCIES.map(
        ([v, label]) => `<option value="${v}" ${p.displayFrequency === v ? "selected" : ""}>${label}</option>`
      ).join("")}</select></div>
    </div>
    <div class="row2">
      <div class="row"><label>Delay before show (ms)</label><input type="number" name="delayMs" min="0" max="60000" step="100" value="${esc(String(p.delayMs ?? 800))}"></div>
      <div class="row"><label>Priority (lower = higher)</label><input type="number" name="priority" min="0" max="9999" value="${esc(String(p.priority ?? 100))}"></div>
    </div>`;
}

module.exports = function registerMarketingPopupRoutes({ app, csrf, token, portalShell }) {
  app.get(`${R}/marketing/popups`, ...guard, authz.requirePermission("marketing.popups.view"), async (req, res) => {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "");
    const rows = await popups.list({ q: q || undefined, status: status || undefined });
    const canCreate = authz.can(req, "marketing.popups.create");
    const canUpdate = authz.can(req, "marketing.popups.update");
    const canDelete = authz.can(req, "marketing.popups.delete");
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>Promotional Popups</strong><div class="muted">CMS-controlled modals on the public website — no code deploy needed to change content</div></div>
        ${canCreate ? `<a class="btn primary sm" href="${R}/marketing/popups/new">Create popup</a>` : ""}
      </div>
      <form class="toolbar" method="get">
        <input name="q" value="${esc(q)}" placeholder="Search">
        <select name="status">
          <option value="">All statuses</option>
          ${["active", "scheduled", "draft", "expired"].map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <button class="btn sm" type="submit">Filter</button>
      </form>
      <table class="stack" style="margin-top:12px"><thead><tr><th>Popup</th><th>Window</th><th>Target</th><th>Status</th><th>Priority</th><th></th></tr></thead>
      <tbody>${
        rows
          .map(
            (p) => `<tr>
          <td data-label="Popup"><strong>${esc(p.name)}</strong>${p.title ? `<div class="muted">${esc(p.title)}</div>` : ""}</td>
          <td data-label="Window">${p.startAt ? esc(String(p.startAt).slice(0, 16).replace("T", " ")) : "—"} → ${p.endAt ? esc(String(p.endAt).slice(0, 16).replace("T", " ")) : "—"}</td>
          <td data-label="Target">${esc((p.targetPages || "").replace(/_/g, " "))}</td>
          <td data-label="Status">${statusBadge(p.status)}</td>
          <td data-label="Priority">${p.priority}</td>
          <td data-label="">
            <a class="btn sm" href="${R}/marketing/popups/${p.id}">Open</a>
            <a class="btn sm" href="${R}/marketing/popups/${p.id}/preview" target="_blank" rel="noopener">Preview</a>
            ${
              canUpdate
                ? `<form method="post" action="${R}/marketing/popups/${p.id}/toggle" style="display:inline">${csrfField}<button class="btn sm" type="submit">${p.enabled ? "Disable" : "Enable"}</button></form>`
                : ""
            }
            ${
              canDelete
                ? `<form method="post" action="${R}/marketing/popups/${p.id}/delete" style="display:inline" onsubmit="return confirm('Delete this popup?');">${csrfField}<button class="btn danger sm" type="submit">Delete</button></form>`
                : ""
            }
          </td>
        </tr>`
          )
          .join("") || `<tr><td colspan="6" class="muted">No popups yet.</td></tr>`
      }</tbody></table>
    </div>`;
    res.send(portalShell("Marketing Popups", inner, req));
  });

  app.get(`${R}/marketing/popups/new`, ...guard, authz.requirePermission("marketing.popups.create"), (req, res) => {
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const blank = {
      enabled: false,
      displayFrequency: "once_per_session",
      targetPages: "homepage_only",
      delayMs: 800,
      priority: 100,
      buttonText: "Contact us",
      buttonUrl: "/pages/contact.html",
    };
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.2fr .8fr;gap:16px">
      <div class="panel"><strong>Create popup</strong>
        <form method="post" action="${R}/marketing/popups" enctype="multipart/form-data" style="margin-top:12px">
          ${formFields(blank, csrfField)}
          <div class="row" style="margin-top:12px"><label>Upload image</label><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif"></div>
          <button class="btn primary" type="submit" style="margin-top:12px">Create</button>
          <a class="btn" href="${R}/marketing/popups">Cancel</a>
        </form>
      </div>
      ${previewCard(blank)}
    </div>`;
    res.send(portalShell("Create Popup", inner, req));
  });

  app.post(
    `${R}/marketing/popups`,
    ...guard,
    authz.requirePermission("marketing.popups.create"),
    (req, res, next) => {
      upload.single("image")(req, res, (err) => {
        if (err) return redirectWith(res, `${R}/marketing/popups/new`, { error: err.message || "Upload failed" });
        next();
      });
    },
    csrf,
    async (req, res) => {
      try {
        const data = validateBody(req.body);
        if (req.file) {
          data.imageUrl = `/uploads/popups/${req.file.filename}`;
        }
        const row = await popups.create(data);
        audit(req, "POPUP_CREATED", { targetType: "marketing_popup", targetId: row.id, next: { name: row.name } });
        redirectWith(res, `${R}/marketing/popups/${row.id}`, { notice: "Popup created." });
      } catch (err) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_e) {
            /* ignore */
          }
        }
        redirectWith(res, `${R}/marketing/popups/new`, { error: err.message || "Could not create" });
      }
    }
  );

  app.get(`${R}/marketing/popups/:id/preview`, ...guard, authz.requirePermission("marketing.popups.view"), async (req, res) => {
    const p = await popups.get(req.params.id);
    if (!p) return redirectWith(res, `${R}/marketing/popups`, { error: "Not found" });
    const title = esc(p.title || p.name || "Popup preview");
    const img = p.imageUrl
      ? `<img class="img" src="${esc(p.imageUrl)}" alt="${title}">`
      : "";
    const btn =
      p.buttonText && p.buttonUrl
        ? `<a class="cta" href="${esc(p.buttonUrl)}">${esc(p.buttonText)}</a>`
        : "";
    const desc = p.description ? `<p class="desc">${esc(p.description)}</p>` : "";
    const heading = p.title ? `<h1>${esc(p.title)}</h1>` : "";
    res.type("html").send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Preview · ${title}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;font:15px/1.45 system-ui,sans-serif;background:#0b1220;color:#0f172a;display:grid;place-items:center;padding:24px}
  .note{position:fixed;top:12px;left:12px;right:12px;background:#fef3c7;color:#78350f;padding:10px 14px;border-radius:10px;font-size:13px;z-index:2}
  .backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px)}
  .modal{position:relative;z-index:1;width:min(520px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.35);animation:in .28s ease}
  .img{display:block;width:100%;max-height:min(58vh,420px);object-fit:contain;background:#f8fafc}
  .body{padding:18px 20px 22px}
  h1{margin:0;font-size:1.25rem}
  .desc{margin:8px 0 0;color:#475569}
  .cta{display:inline-flex;margin-top:14px;padding:10px 16px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600}
  .x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:20px;cursor:pointer}
  @keyframes in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
</style></head><body>
<div class="note">Admin preview only — this page is not public and does not enable the popup for visitors.</div>
<div class="backdrop"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
  <button class="x" type="button" onclick="history.back()" aria-label="Close">×</button>
  ${img}
  <div class="body">${heading}${desc}${btn}</div>
</div>
</body></html>`);
  });

  app.get(`${R}/marketing/popups/:id`, ...guard, authz.requirePermission("marketing.popups.view"), async (req, res) => {
    if (req.params.id === "new") return;
    const p = await popups.get(req.params.id);
    if (!p) return redirectWith(res, `${R}/marketing/popups`, { error: "Not found" });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const canUpdate = authz.can(req, "marketing.popups.update");
    const canDelete = authz.can(req, "marketing.popups.delete");
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.2fr .8fr;gap:16px">
      <div class="panel">
        <div class="panel-head">
          <div><strong>${esc(p.name)}</strong> ${statusBadge(p.status)}
            <div class="muted">${p.enabled ? "Enabled" : "Disabled"} · ${esc((p.targetPages || "").replace(/_/g, " "))} · ${esc((p.displayFrequency || "").replace(/_/g, " "))}</div>
          </div>
          <div class="actions">
            <a class="btn sm" href="${R}/marketing/popups">All</a>
            <a class="btn sm" href="${R}/marketing/popups/${p.id}/preview" target="_blank" rel="noopener">Preview</a>
            ${
              canUpdate
                ? `<form method="post" action="${R}/marketing/popups/${p.id}/toggle" style="display:inline">${csrfField}<button class="btn sm" type="submit">${p.enabled ? "Disable" : "Enable"}</button></form>`
                : ""
            }
            ${
              canDelete
                ? `<form method="post" action="${R}/marketing/popups/${p.id}/delete" style="display:inline" onsubmit="return confirm('Delete this popup?');">${csrfField}<button class="btn danger sm" type="submit">Delete</button></form>`
                : ""
            }
          </div>
        </div>
        ${
          canUpdate
            ? `<form method="post" action="${R}/marketing/popups/${p.id}" enctype="multipart/form-data" style="margin-top:12px">
          ${formFields(p, csrfField)}
          <div class="row" style="margin-top:12px"><label>Replace image</label><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif"></div>
          <button class="btn primary" type="submit" style="margin-top:12px">Save</button>
        </form>`
            : `<p>${esc(p.title || "")}</p><p class="muted">${esc(p.description || "")}</p>`
        }
      </div>
      ${previewCard(p)}
    </div>`;
    res.send(portalShell("Marketing Popups", inner, req));
  });

  app.post(
    `${R}/marketing/popups/:id`,
    ...guard,
    authz.requirePermission("marketing.popups.update"),
    (req, res, next) => {
      upload.single("image")(req, res, (err) => {
        if (err) return redirectWith(res, `${R}/marketing/popups/${req.params.id}`, { error: err.message || "Upload failed" });
        next();
      });
    },
    csrf,
    async (req, res) => {
      try {
        const data = validateBody(req.body);
        if (req.file) data.imageUrl = `/uploads/popups/${req.file.filename}`;
        await popups.update(req.params.id, data);
        audit(req, "POPUP_EDITED", { targetType: "marketing_popup", targetId: req.params.id });
        redirectWith(res, `${R}/marketing/popups/${req.params.id}`, { notice: "Popup saved." });
      } catch (err) {
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_e) {
            /* ignore */
          }
        }
        redirectWith(res, `${R}/marketing/popups/${req.params.id}`, { error: err.message || "Save failed" });
      }
    }
  );

  app.post(`${R}/marketing/popups/:id/toggle`, ...guard, csrf, authz.requirePermission("marketing.popups.update"), async (req, res) => {
    try {
      const existing = await popups.get(req.params.id);
      if (!existing) return redirectWith(res, `${R}/marketing/popups`, { error: "Not found" });
      await popups.setEnabled(req.params.id, !existing.enabled);
      audit(req, existing.enabled ? "POPUP_DISABLED" : "POPUP_ENABLED", {
        targetType: "marketing_popup",
        targetId: req.params.id,
      });
      redirectWith(res, `${R}/marketing/popups/${req.params.id}`, {
        notice: existing.enabled ? "Popup disabled." : "Popup enabled.",
      });
    } catch (err) {
      redirectWith(res, `${R}/marketing/popups`, { error: err.message || "Toggle failed" });
    }
  });

  app.post(`${R}/marketing/popups/:id/delete`, ...guard, csrf, authz.requirePermission("marketing.popups.delete"), async (req, res) => {
    await popups.softDelete(req.params.id);
    audit(req, "POPUP_DELETED", { targetType: "marketing_popup", targetId: req.params.id });
    redirectWith(res, `${R}/marketing/popups`, { notice: "Popup deleted." });
  });
};
