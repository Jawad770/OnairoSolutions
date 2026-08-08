/**
 * Catalog Manager — Super Admin portal for commercial offerings.
 */
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const authz = require("./authz");
const { CatalogRepository: catalog } = require("./db/repositories/catalog");
const versioning = require("./catalogVersioning");

const { esc } = views;
const R = config.portalRoute;

function flash(req) {
  const notice = req.query.notice ? `<div class="notice">${esc(req.query.notice)}</div>` : "";
  const error = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : "";
  return notice + error;
}

function redirectWith(res, pathName, params) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${pathName}${qs ? `?${qs}` : ""}`);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function bool(v) {
  return v === true || v === "on" || v === "1" || v === "true";
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusBadge(status) {
  const map = { published: "ok", draft: "warn", preview: "warn", archived: "off" };
  return `<span class="badge ${map[status] || ""}">${esc(status || "draft")}</span>`;
}

const catalogUploadDir = path.join(config.uploadDir, "catalog");
fs.mkdirSync(catalogUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const itemId = String(req.params.id || "shared");
    const dir = path.join(catalogUploadDir, itemId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(png|jpeg|jpg|webp|gif|svg\+xml)|application\/pdf|video\/(mp4|webm))$/i.test(
      file.mimetype || ""
    );
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

const catalogGuard = [authz.requireAuth, authz.requireActiveUser, authz.requireSuperAdmin];

async function captureRevision(itemId, req, opts = {}) {
  if (!itemId) return null;
  try {
    return await versioning.createRevision({ itemId, req, ...opts });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[catalog versioning]", err?.message || err);
    return null;
  }
}

function formatChangeValue(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return esc(JSON.stringify(v));
  return esc(String(v));
}

function renderChangeRows(changes) {
  if (!changes?.length) return `<p class="muted">No field-level changes recorded.</p>`;
  return `<table class="stack" style="margin-top:8px"><thead><tr><th>What</th><th>Change</th><th>Before</th><th></th><th>After</th></tr></thead><tbody>${changes
    .map((c) => {
      const label = `${esc(c.entityType)} · ${esc(c.entityKey)} · ${esc(c.field)}`;
      if (c.changeType === "added") {
        return `<tr><td data-label="What">${label}</td><td data-label="Change"><span class="badge">+</span> Added</td><td data-label="Before">—</td><td>↓</td><td data-label="After">${formatChangeValue(c.afterJson)}</td></tr>`;
      }
      if (c.changeType === "removed") {
        return `<tr><td data-label="What">${label}</td><td data-label="Change"><span class="badge warn">−</span> Removed</td><td data-label="Before">${formatChangeValue(c.beforeJson)}</td><td>↓</td><td data-label="After">—</td></tr>`;
      }
      return `<tr><td data-label="What">${label}</td><td data-label="Change">Modified</td><td data-label="Before">${formatChangeValue(c.beforeJson)}</td><td>↓</td><td data-label="After">${formatChangeValue(c.afterJson)}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

module.exports = function registerCatalogRoutes({ app, csrf, token, portalShell }) {
  /* ---------- Products list ---------- */
  app.get(`${R}/catalog`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const status = String(req.query.status || "");
      const items = await catalog.listItems({ q, status: status || undefined, admin: true });
      const inner = `${flash(req)}
      <div class="panel">
        <div class="panel-head">
          <div><strong>Catalog Products</strong><div class="muted">Commercial offerings managed in Onairo Core</div></div>
          <a class="btn primary sm" href="${R}/catalog/new">New product</a>
        </div>
        <form class="toolbar" method="get">
          <input name="q" value="${esc(q)}" placeholder="Search name or slug">
          <select name="status">
            <option value="">All statuses</option>
            ${["draft", "preview", "published", "archived"]
              .map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <button class="btn sm" type="submit">Filter</button>
        </form>
        <table class="stack" style="margin-top:12px">
          <thead><tr><th>Product</th><th>Category</th><th>Type</th><th>Status</th><th>Visibility</th><th></th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `<tr>
              <td data-label="Product"><strong>${esc(item.name)}</strong><div class="muted">${esc(item.slug)}</div></td>
              <td data-label="Category">${esc(item.category?.name || "—")}</td>
              <td data-label="Type">${esc(item.productType?.name || "—")}</td>
              <td data-label="Status">${statusBadge(item.workflowStatus)}${item.comingSoon ? ' <span class="badge warn">Coming Soon</span>' : ""}</td>
              <td data-label="Visibility">${item.visibleWebsite ? "Website" : "—"}${item.visibleAi ? " · AI" : ""}</td>
              <td data-label=""><a class="btn sm" href="${R}/catalog/${item.id}">Open</a></td>
            </tr>`
              )
              .join("") || `<tr><td colspan="6" class="muted">No catalog items yet. Seed or create one.</td></tr>`}
          </tbody>
        </table>
      </div>`;
      res.send(portalShell("Catalog Manager", inner, req));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog]", err);
      res.send(portalShell("Catalog Manager", `<div class="error">Failed to load catalog.</div>`, req));
    }
  });

  app.get(`${R}/products`, ...catalogGuard, (req, res) => res.redirect(`${R}/catalog`));

  /* ---------- Categories ---------- */
  app.get(`${R}/catalog/categories`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const rows = await catalog.listCategories({ includeDisabled: true });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.2fr .8fr">
      <div class="panel"><strong>Categories</strong>
        <table class="stack" style="margin-top:10px"><thead><tr><th>Name</th><th>Slug</th><th>Order</th><th>Enabled</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr>
            <td data-label="Name">${esc(r.name)}</td>
            <td data-label="Slug">${esc(r.slug)}</td>
            <td data-label="Order">${r.displayOrder}</td>
            <td data-label="Enabled">${r.enabled ? "Yes" : "No"}</td>
          </tr>`
          )
          .join("")}</tbody></table>
      </div>
      <div class="panel"><strong>Add category</strong>
        <form method="post" action="${R}/catalog/categories" style="margin-top:10px">
          ${csrfField}
          <div class="row"><label>Name</label><input name="name" required></div>
          <div class="row"><label>Slug</label><input name="slug" placeholder="auto from name"></div>
          <div class="row"><label>Description</label><textarea name="description"></textarea></div>
          <div class="row"><label>Display order</label><input name="displayOrder" type="number" value="0"></div>
          <label class="row" style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="enabled" checked> Enabled</label>
          <button class="btn primary" type="submit">Create</button>
        </form>
      </div>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/categories`, ...catalogGuard, csrf, authz.requirePermission("catalog.create"), async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return redirectWith(res, `${R}/catalog/categories`, { error: "Name required" });
    const slug = slugify(req.body.slug || name);
    const row = await catalog.createCategory({
      name,
      slug,
      description: String(req.body.description || "").trim() || null,
      displayOrder: Number(req.body.displayOrder) || 0,
      enabled: bool(req.body.enabled),
    });
    audit(req, "CATALOG_CATEGORY_CREATED", { targetType: "catalog_category", targetId: row.id, next: { name, slug } });
    redirectWith(res, `${R}/catalog/categories`, { notice: "Category created." });
  });

  /* ---------- Types ---------- */
  app.get(`${R}/catalog/types`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const rows = await catalog.listTypes({ includeDisabled: true });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.2fr .8fr">
      <div class="panel"><strong>Product Types</strong>
        <table class="stack" style="margin-top:10px"><thead><tr><th>Name</th><th>Slug</th><th>Order</th><th>Enabled</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr><td data-label="Name">${esc(r.name)}</td><td data-label="Slug">${esc(r.slug)}</td><td data-label="Order">${r.displayOrder}</td><td data-label="Enabled">${r.enabled ? "Yes" : "No"}</td></tr>`
          )
          .join("")}</tbody></table>
      </div>
      <div class="panel"><strong>Add type</strong>
        <form method="post" action="${R}/catalog/types" style="margin-top:10px">
          ${csrfField}
          <div class="row"><label>Name</label><input name="name" required></div>
          <div class="row"><label>Slug</label><input name="slug"></div>
          <div class="row"><label>Display order</label><input name="displayOrder" type="number" value="0"></div>
          <label class="row" style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="enabled" checked> Enabled</label>
          <button class="btn primary" type="submit">Create</button>
        </form>
      </div>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/types`, ...catalogGuard, csrf, authz.requirePermission("catalog.create"), async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return redirectWith(res, `${R}/catalog/types`, { error: "Name required" });
    const row = await catalog.createType({
      name,
      slug: slugify(req.body.slug || name),
      displayOrder: Number(req.body.displayOrder) || 0,
      enabled: bool(req.body.enabled),
    });
    audit(req, "CATALOG_TYPE_CREATED", { targetType: "product_type", targetId: row.id, next: { name: row.name } });
    redirectWith(res, `${R}/catalog/types`, { notice: "Product type created." });
  });

  /* ---------- New item ---------- */
  app.get(`${R}/catalog/new`, ...catalogGuard, authz.requirePermission("catalog.create"), async (req, res) => {
    const [categories, types] = await Promise.all([
      catalog.listCategories({ includeDisabled: true }),
      catalog.listTypes({ includeDisabled: true }),
    ]);
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel" style="max-width:820px">
      <strong>New catalog product</strong>
      <form method="post" action="${R}/catalog" style="margin-top:12px">
        ${csrfField}
        <div class="row2">
          <div class="row"><label>Name *</label><input name="name" required></div>
          <div class="row"><label>Slug</label><input name="slug" placeholder="auto"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Category *</label><select name="categoryId" required>${categories
            .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
            .join("")}</select></div>
          <div class="row"><label>Product type *</label><select name="productTypeId" required>${types
            .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`)
            .join("")}</select></div>
        </div>
        <div class="row"><label>Short description</label><textarea name="shortDescription"></textarea></div>
        <div class="row"><label>Full description</label><textarea name="fullDescription" rows="5"></textarea></div>
        <div class="row2">
          <div class="row"><label>CTA text</label><input name="ctaText"></div>
          <div class="row"><label>CTA link</label><input name="ctaLink"></div>
        </div>
        <div class="row2">
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleWebsite" checked> Website</label>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleAi" checked> Onairo AI</label>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="comingSoon"> Coming Soon</label>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="featured"> Featured</label>
        </div>
        <button class="btn primary" type="submit">Save draft</button>
        <a class="btn" href="${R}/catalog">Cancel</a>
      </form>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog`, ...catalogGuard, csrf, authz.requirePermission("catalog.create"), async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return redirectWith(res, `${R}/catalog/new`, { error: "Name required" });
    const item = await catalog.createItem({
      name,
      slug: slugify(req.body.slug || name),
      shortDescription: String(req.body.shortDescription || "").trim() || null,
      fullDescription: String(req.body.fullDescription || "").trim() || null,
      categoryId: req.body.categoryId,
      productTypeId: req.body.productTypeId,
      ctaText: String(req.body.ctaText || "").trim() || null,
      ctaLink: String(req.body.ctaLink || "").trim() || null,
      featured: bool(req.body.featured),
      comingSoon: bool(req.body.comingSoon),
      visibleWebsite: bool(req.body.visibleWebsite),
      visibleAi: bool(req.body.visibleAi),
      visibleComingSoon: bool(req.body.comingSoon),
      notifyMeEnabled: bool(req.body.notifyMeEnabled || req.body.comingSoon),
      workflowStatus: "draft",
    });
    audit(req, "CATALOG_ITEM_CREATED", { targetType: "catalog_item", targetId: item.id, next: { name: item.name, slug: item.slug } });
    await captureRevision(item.id, req, { forceInitial: true, summaryHint: "Initial Release" });
    redirectWith(res, `${R}/catalog/${item.id}`, { notice: "Draft created." });
  });

  /* ---------- Item detail / edit ---------- */
  const RESERVED_CATALOG_SEGMENTS = new Set([
    "categories",
    "types",
    "plans",
    "pricing",
    "features",
    "campaigns",
    "notify",
    "downloads",
    "licenses",
    "new",
    "media",
    "promotions",
    "marketing",
    "sandbox",
  ]);

  app.get(`${R}/catalog/:id`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res, next) => {
    if (RESERVED_CATALOG_SEGMENTS.has(req.params.id)) return next("route");
    const item = await catalog.getItem(req.params.id, { admin: true });
    if (!item || item.deletedAt) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const [categories, types, revisions] = await Promise.all([
      catalog.listCategories({ includeDisabled: true }),
      catalog.listTypes({ includeDisabled: true }),
      versioning.listRevisions(item.id),
    ]);
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const plans = item.plans || [];
    const media = item.media || [];
    const changelogs = item.changelogs || [];
    const currentVer = revisions.find((r) => r.status === "current") || revisions[0];

    const preview = `<div class="panel" id="livePreview">
      <strong>Live preview</strong>
      <div class="card" style="margin-top:10px">
        <div class="muted">${esc(item.category?.name || "")} · ${esc(item.productType?.name || "")}</div>
        <h3 style="margin:6px 0">${esc(item.name)}</h3>
        <p class="muted">${esc(item.shortDescription || "")}</p>
        <div>${statusBadge(item.workflowStatus)}${item.comingSoon ? ' <span class="badge warn">Coming Soon</span>' : ""}</div>
        <ul style="margin:10px 0 0;padding-left:18px">${plans
          .filter((p) => !p.archivedAt)
          .map(
            (p) =>
              `<li>${esc(p.name)} — ${
                p.monthlyPrice != null ? `${esc(p.currency)} ${esc(String(p.monthlyPrice))}/mo` : p.oneTimePrice != null ? `${esc(p.currency)} ${esc(String(p.oneTimePrice))}` : "Custom"
              } ${p.recommended ? "(Recommended)" : ""}</li>`
          )
          .join("")}</ul>
      </div>
    </div>`;

    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.4fr .8fr">
      <div>
        <div class="panel">
          <div class="panel-head">
            <div><strong>${esc(item.name)}</strong><div class="muted">${esc(item.slug)} · ${statusBadge(item.workflowStatus)}${currentVer ? ` · <span class="badge">v${currentVer.versionNumber}</span>` : ""}</div></div>
            <div class="actions">
              <a class="btn sm" href="${R}/catalog/${item.id}/versions">Version history</a>
              <form method="post" action="${R}/catalog/${item.id}/workflow" style="display:inline">${csrfField}<input type="hidden" name="action" value="preview"><button class="btn sm" type="submit">Mark preview</button></form>
              <form method="post" action="${R}/catalog/${item.id}/workflow" style="display:inline">${csrfField}<input type="hidden" name="action" value="publish"><button class="btn primary sm" type="submit">Publish</button></form>
              <form method="post" action="${R}/catalog/${item.id}/workflow" style="display:inline">${csrfField}<input type="hidden" name="action" value="archive"><button class="btn danger sm" type="submit">Archive</button></form>
            </div>
          </div>
          <form method="post" action="${R}/catalog/${item.id}">
            ${csrfField}
            <div class="row2">
              <div class="row"><label>Name</label><input name="name" value="${esc(item.name)}" required></div>
              <div class="row"><label>Slug</label><input name="slug" value="${esc(item.slug)}" required></div>
            </div>
            <div class="row2">
              <div class="row"><label>Category</label><select name="categoryId">${categories
                .map((c) => `<option value="${c.id}" ${c.id === item.categoryId ? "selected" : ""}>${esc(c.name)}</option>`)
                .join("")}</select></div>
              <div class="row"><label>Type</label><select name="productTypeId">${types
                .map((t) => `<option value="${t.id}" ${t.id === item.productTypeId ? "selected" : ""}>${esc(t.name)}</option>`)
                .join("")}</select></div>
            </div>
            <div class="row"><label>Short description</label><textarea name="shortDescription">${esc(item.shortDescription || "")}</textarea></div>
            <div class="row"><label>Full description</label><textarea name="fullDescription" rows="5">${esc(item.fullDescription || "")}</textarea></div>
            <div class="row2">
              <div class="row"><label>CTA text</label><input name="ctaText" value="${esc(item.ctaText || "")}"></div>
              <div class="row"><label>CTA link</label><input name="ctaLink" value="${esc(item.ctaLink || "")}"></div>
            </div>
            <div class="row2">
              <div class="row"><label>SEO title</label><input name="seoTitle" value="${esc(item.seoTitle || "")}"></div>
              <div class="row"><label>Accent color</label><input name="accentColor" value="${esc(item.accentColor || "")}" placeholder="#2563EB"></div>
            </div>
            <div class="row"><label>SEO description</label><textarea name="seoDescription">${esc(item.seoDescription || "")}</textarea></div>
            <div class="row2">
              <div class="row"><label>Schedule publish at</label><input type="datetime-local" name="publishAt" value="${item.publishAt ? esc(new Date(item.publishAt).toISOString().slice(0, 16)) : ""}"></div>
              <div class="row"><label>Timezone</label><input name="publishTimezone" value="${esc(item.publishTimezone || "Asia/Karachi")}"></div>
            </div>
            <div class="row2">
              <div class="row"><label>Expected launch</label><input type="datetime-local" name="expectedLaunchAt" value="${item.expectedLaunchAt ? esc(new Date(item.expectedLaunchAt).toISOString().slice(0, 16)) : ""}"></div>
              <div class="row"><label>Coming soon description</label><input name="comingSoonDescription" value="${esc(item.comingSoonDescription || "")}"></div>
            </div>
            <div class="row2">
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleWebsite" ${item.visibleWebsite ? "checked" : ""}> Website</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleAi" ${item.visibleAi ? "checked" : ""}> AI</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleCrm" ${item.visibleCrm ? "checked" : ""}> CRM</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleCustomerPortal" ${item.visibleCustomerPortal ? "checked" : ""}> Customer portal</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleDownloads" ${item.visibleDownloads ? "checked" : ""}> Downloads</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="comingSoon" ${item.comingSoon ? "checked" : ""}> Coming Soon</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="notifyMeEnabled" ${item.notifyMeEnabled ? "checked" : ""}> Notify Me</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="countdownEnabled" ${item.countdownEnabled ? "checked" : ""}> Countdown</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="featured" ${item.featured ? "checked" : ""}> Featured</label>
              <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="visibleHidden" ${item.visibleHidden ? "checked" : ""}> Hidden</label>
            </div>
            <button class="btn primary" type="submit">Save draft</button>
          </form>
        </div>

        <div class="panel">
          <div class="panel-head"><strong>Plans</strong>
            <a class="btn sm" href="${R}/catalog/${item.id}/plans/new">Add plan</a>
          </div>
          <table class="stack"><thead><tr><th>Plan</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>${plans
            .map(
              (p) => `<tr>
              <td data-label="Plan">${esc(p.name)} ${p.recommended ? '<span class="badge ok">Recommended</span>' : ""} ${p.popular ? '<span class="badge">Popular</span>' : ""}</td>
              <td data-label="Price">${p.monthlyPrice != null ? `${esc(p.currency)} ${esc(String(p.monthlyPrice))}/mo` : p.oneTimePrice != null ? `${esc(p.currency)} ${esc(String(p.oneTimePrice))}` : "Custom"}</td>
              <td data-label="Status">${statusBadge(p.workflowStatus)}</td>
              <td data-label=""><a class="btn sm" href="${R}/catalog/plans/${p.id}">Edit</a>
                <form method="post" action="${R}/catalog/plans/${p.id}/duplicate" style="display:inline">${csrfField}<button class="btn sm" type="submit">Duplicate</button></form>
              </td>
            </tr>`
            )
            .join("") || `<tr><td colspan="4" class="muted">No plans yet.</td></tr>`}</tbody></table>
        </div>

        <div class="panel">
          <div class="panel-head"><strong>Media library</strong></div>
          <form method="post" action="${R}/catalog/${item.id}/media" enctype="multipart/form-data" class="toolbar">
            ${csrfField}
            <select name="mediaType">
              ${["logo", "hero", "icon", "gallery", "screenshot", "banner", "video", "pdf", "brochure", "thumbnail", "animation", "demo_gif"]
                .map((t) => `<option value="${t}">${t}</option>`)
                .join("")}
            </select>
            <input type="file" name="file" required>
            <input name="alt" placeholder="Alt text">
            <button class="btn sm" type="submit">Upload</button>
          </form>
          <table class="stack" style="margin-top:10px"><thead><tr><th>Type</th><th>URL</th><th>Order</th><th></th></tr></thead>
          <tbody>${media
            .map(
              (m) => `<tr>
              <td data-label="Type">${esc(m.mediaType)}</td>
              <td data-label="URL"><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.url)}</a></td>
              <td data-label="Order">${m.displayOrder}</td>
              <td data-label=""><form method="post" action="${R}/catalog/media/${m.id}/delete">${csrfField}<button class="btn danger sm" type="submit">Remove</button></form></td>
            </tr>`
            )
            .join("") || `<tr><td colspan="4" class="muted">No media yet.</td></tr>`}</tbody></table>
        </div>

        <div class="panel">
          <div class="panel-head"><strong>Changelog</strong></div>
          <form method="post" action="${R}/catalog/${item.id}/changelog" class="toolbar" style="flex-direction:column;align-items:stretch">
            ${csrfField}
            <div class="row2"><input name="version" placeholder="Version e.g. 2.1" required><input name="title" placeholder="Title" required></div>
            <textarea name="body" placeholder="What changed" required></textarea>
            <button class="btn sm" type="submit">Add entry</button>
          </form>
          ${changelogs
            .map(
              (c) => `<div class="card" style="margin-top:8px"><strong>${esc(c.version)}</strong> — ${esc(c.title)}<div class="muted">${esc(String(c.releasedAt).slice(0, 10))}</div><p>${esc(c.body)}</p></div>`
            )
            .join("") || '<p class="muted">No changelog entries.</p>'}
        </div>
        <div class="panel" style="margin-top:12px">
          <div class="panel-head"><strong>Version History</strong>
            <a class="btn sm" href="${R}/catalog/${item.id}/versions">View all</a>
          </div>
          <table class="stack" style="margin-top:8px"><thead><tr><th>Version</th><th>Summary</th><th>By</th><th>Date</th><th></th></tr></thead>
          <tbody>${revisions
            .slice(0, 8)
            .map(
              (r) => `<tr>
              <td data-label="Version">v${r.versionNumber}${r.status === "current" ? ' <span class="badge">Current</span>' : ""}</td>
              <td data-label="Summary">${esc(r.summary)}</td>
              <td data-label="By">${esc(r.createdByEmail || "—")}</td>
              <td data-label="Date">${esc(String(r.createdAt).slice(0, 16).replace("T", " "))}</td>
              <td data-label=""><a class="btn sm" href="${R}/catalog/${item.id}/versions/${r.versionNumber}">View</a></td>
            </tr>`
            )
            .join("") || `<tr><td colspan="5" class="muted">No versions yet — save the product to create Version 1.</td></tr>`}</tbody></table>
          ${
            revisions.length >= 2
              ? `<form class="toolbar" method="get" action="${R}/catalog/${item.id}/versions/compare" style="margin-top:10px">
            <label>Compare</label>
            <select name="a">${revisions.map((r) => `<option value="${r.versionNumber}">v${r.versionNumber}</option>`).join("")}</select>
            <select name="b">${revisions.map((r, i) => `<option value="${r.versionNumber}" ${i === 0 ? "selected" : ""}>v${r.versionNumber}</option>`).join("")}</select>
            <button class="btn sm" type="submit">Compare</button>
          </form>`
              : ""
          }
        </div>
      </div>
      ${preview}
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/:id`, ...catalogGuard, csrf, authz.requirePermission("catalog.update"), async (req, res, next) => {
    if (RESERVED_CATALOG_SEGMENTS.has(req.params.id)) return next("route");
    const id = req.params.id;
    const existing = await catalog.getItem(id, { admin: true });
    if (!existing) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const previous = { name: existing.name, workflowStatus: existing.workflowStatus };
    const data = {
      name: String(req.body.name || "").trim(),
      slug: slugify(req.body.slug || req.body.name),
      shortDescription: String(req.body.shortDescription || "").trim() || null,
      fullDescription: String(req.body.fullDescription || "").trim() || null,
      categoryId: req.body.categoryId,
      productTypeId: req.body.productTypeId,
      ctaText: String(req.body.ctaText || "").trim() || null,
      ctaLink: String(req.body.ctaLink || "").trim() || null,
      seoTitle: String(req.body.seoTitle || "").trim() || null,
      seoDescription: String(req.body.seoDescription || "").trim() || null,
      accentColor: String(req.body.accentColor || "").trim() || null,
      featured: bool(req.body.featured),
      comingSoon: bool(req.body.comingSoon),
      notifyMeEnabled: bool(req.body.notifyMeEnabled),
      countdownEnabled: bool(req.body.countdownEnabled),
      comingSoonDescription: String(req.body.comingSoonDescription || "").trim() || null,
      expectedLaunchAt: req.body.expectedLaunchAt ? new Date(req.body.expectedLaunchAt) : null,
      publishAt: req.body.publishAt ? new Date(req.body.publishAt) : null,
      publishTimezone: String(req.body.publishTimezone || "Asia/Karachi").trim(),
      visibleWebsite: bool(req.body.visibleWebsite),
      visibleAi: bool(req.body.visibleAi),
      visibleCrm: bool(req.body.visibleCrm),
      visibleCustomerPortal: bool(req.body.visibleCustomerPortal),
      visibleDownloads: bool(req.body.visibleDownloads),
      visibleComingSoon: bool(req.body.comingSoon),
      visibleHidden: bool(req.body.visibleHidden),
      workflowStatus: existing.workflowStatus === "published" ? "draft" : existing.workflowStatus,
    };
    await catalog.updateItem(id, data);
    audit(req, "CATALOG_ITEM_UPDATED", { targetType: "catalog_item", targetId: id, previous, next: { name: data.name } });
    await captureRevision(id, req);
    redirectWith(res, `${R}/catalog/${id}`, { notice: "Saved as draft. Publish when ready." });
  });

  app.post(`${R}/catalog/:id/workflow`, ...catalogGuard, csrf, authz.requirePermission("catalog.publish"), async (req, res) => {
    const id = req.params.id;
    const action = String(req.body.action || "");
    const existing = await catalog.getItem(id, { admin: true });
    if (!existing) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const map = {
      preview: { workflowStatus: "preview" },
      publish: { workflowStatus: "published", publishedAt: new Date(), publishAt: null },
      archive: { workflowStatus: "archived" },
      draft: { workflowStatus: "draft" },
    };
    const data = map[action];
    if (!data) return redirectWith(res, `${R}/catalog/${id}`, { error: "Unknown action" });
    await catalog.updateItem(id, data);
    audit(req, `PUBLISH_${action.toUpperCase()}`, {
      targetType: "catalog_item",
      targetId: id,
      previous: { workflowStatus: existing.workflowStatus },
      next: data,
    });
    await captureRevision(id, req, { summaryHint: action === "publish" ? "Published" : `Marked ${action}` });
    redirectWith(res, `${R}/catalog/${id}`, { notice: `Marked as ${action}.` });
  });

  /* ---------- Plans ---------- */
  app.get(`${R}/catalog/plans`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const items = await catalog.listItems({ admin: true });
    const rows = items.flatMap((item) =>
      (item.plans || []).map((p) => ({ ...p, itemName: item.name, itemId: item.id }))
    );
    const inner = `${flash(req)}
    <div class="panel"><strong>All plans</strong>
      <table class="stack" style="margin-top:10px"><thead><tr><th>Product</th><th>Plan</th><th>Price</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (p) => `<tr>
          <td data-label="Product">${esc(p.itemName)}</td>
          <td data-label="Plan">${esc(p.name)}</td>
          <td data-label="Price">${p.monthlyPrice != null ? `${esc(p.currency)} ${esc(String(p.monthlyPrice))}/mo` : "Custom"}</td>
          <td data-label="Status">${statusBadge(p.workflowStatus)}</td>
          <td data-label=""><a class="btn sm" href="${R}/catalog/plans/${p.id}">Edit</a></td>
        </tr>`
        )
        .join("") || `<tr><td colspan="5" class="muted">No plans.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/pricing`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const items = await catalog.listItems({ admin: true });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const rows = items.flatMap((item) =>
      (item.plans || []).map((p) => ({ ...p, itemName: item.name }))
    );
    const inner = `${flash(req)}
    <div class="panel"><strong>Pricing matrix</strong>
      <table class="stack" style="margin-top:10px"><thead><tr><th>Product</th><th>Plan</th><th>Monthly</th><th>Yearly</th><th>One-time</th><th>Currency</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (p) => `<tr>
          <form method="post" action="${R}/catalog/plans/${p.id}/price">
          ${csrfField}
          <td data-label="Product">${esc(p.itemName)}</td>
          <td data-label="Plan">${esc(p.name)}</td>
          <td data-label="Monthly"><input name="monthlyPrice" value="${p.monthlyPrice ?? ""}" style="min-width:90px"></td>
          <td data-label="Yearly"><input name="yearlyPrice" value="${p.yearlyPrice ?? ""}" style="min-width:90px"></td>
          <td data-label="One-time"><input name="oneTimePrice" value="${p.oneTimePrice ?? ""}" style="min-width:90px"></td>
          <td data-label="Currency"><input name="currency" value="${esc(p.currency || "PKR")}" style="min-width:70px"></td>
          <td data-label=""><button class="btn sm" type="submit">Save</button></td>
          </form>
        </tr>`
        )
        .join("") || `<tr><td colspan="7" class="muted">No plans.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/features`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const items = await catalog.listItems({ admin: true });
    const rows = items.flatMap((item) =>
      (item.plans || []).flatMap((p) =>
        (p.features || []).map((f) => ({ ...f, planName: p.name, itemName: item.name, planId: p.id }))
      )
    );
    const inner = `${flash(req)}
    <div class="panel"><strong>Plan features</strong>
      <table class="stack" style="margin-top:10px"><thead><tr><th>Product</th><th>Plan</th><th>Feature</th><th>Included</th><th>Value</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (f) => `<tr>
          <td data-label="Product">${esc(f.itemName)}</td>
          <td data-label="Plan">${esc(f.planName)}</td>
          <td data-label="Feature">${esc(f.title)}</td>
          <td data-label="Included">${f.included ? "Yes" : "No"}</td>
          <td data-label="Value">${esc(f.valueText || "—")}</td>
          <td data-label=""><a class="btn sm" href="${R}/catalog/plans/${f.planId}">Manage</a></td>
        </tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No features yet.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/:itemId/plans/new`, ...catalogGuard, authz.requirePermission("catalog.manage_plans"), async (req, res) => {
    const item = await catalog.getItem(req.params.itemId, { admin: true });
    if (!item) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel" style="max-width:720px"><strong>New plan for ${esc(item.name)}</strong>
      <form method="post" action="${R}/catalog/${item.id}/plans" style="margin-top:12px">
        ${csrfField}
        <div class="row2"><div class="row"><label>Name</label><input name="name" required></div><div class="row"><label>Subtitle</label><input name="subtitle"></div></div>
        <div class="row2">
          <div class="row"><label>Monthly price</label><input name="monthlyPrice" type="number" step="0.01"></div>
          <div class="row"><label>Yearly price</label><input name="yearlyPrice" type="number" step="0.01"></div>
          <div class="row"><label>One-time price</label><input name="oneTimePrice" type="number" step="0.01"></div>
          <div class="row"><label>Currency</label><input name="currency" value="PKR"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Badge</label><input name="badge"></div>
          <div class="row"><label>CTA text</label><input name="ctaText"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="recommended"> Recommended</label>
        <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="popular"> Popular</label>
        <button class="btn primary" type="submit">Create plan</button>
      </form>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/:itemId/plans`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_plans"), async (req, res) => {
    const itemId = req.params.itemId;
    const name = String(req.body.name || "").trim();
    if (!name) return redirectWith(res, `${R}/catalog/${itemId}/plans/new`, { error: "Name required" });
    const plan = await catalog.createPlan({
      itemId,
      name,
      subtitle: String(req.body.subtitle || "").trim() || null,
      monthlyPrice: numOrNull(req.body.monthlyPrice),
      yearlyPrice: numOrNull(req.body.yearlyPrice),
      oneTimePrice: numOrNull(req.body.oneTimePrice),
      currency: String(req.body.currency || "PKR").trim() || "PKR",
      badge: String(req.body.badge || "").trim() || null,
      ctaText: String(req.body.ctaText || "").trim() || null,
      recommended: bool(req.body.recommended),
      popular: bool(req.body.popular),
      workflowStatus: "draft",
      visibleWebsite: true,
    });
    audit(req, "PLAN_CREATED", { targetType: "catalog_plan", targetId: plan.id, next: { name, itemId } });
    await captureRevision(itemId, req, { summaryHint: `Added plan ${name}` });
    redirectWith(res, `${R}/catalog/plans/${plan.id}`, { notice: "Plan created." });
  });

  app.get(`${R}/catalog/plans/:id`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const plan = await catalog.getPlan(req.params.id);
    if (!plan) return redirectWith(res, `${R}/catalog/plans`, { error: "Not found" });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const features = plan.features || [];
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="panel">
        <div class="panel-head"><strong>${esc(plan.name)}</strong> ${statusBadge(plan.workflowStatus)}
          <div class="actions">
            <form method="post" action="${R}/catalog/plans/${plan.id}/workflow">${csrfField}<input type="hidden" name="action" value="publish"><button class="btn primary sm" type="submit">Publish plan</button></form>
            <a class="btn sm" href="${R}/catalog/${plan.itemId}">Back to product</a>
          </div>
        </div>
        <form method="post" action="${R}/catalog/plans/${plan.id}">
          ${csrfField}
          <div class="row"><label>Name</label><input name="name" value="${esc(plan.name)}" required></div>
          <div class="row"><label>Subtitle</label><input name="subtitle" value="${esc(plan.subtitle || "")}"></div>
          <div class="row2">
            <div class="row"><label>Monthly</label><input name="monthlyPrice" value="${plan.monthlyPrice ?? ""}"></div>
            <div class="row"><label>Yearly</label><input name="yearlyPrice" value="${plan.yearlyPrice ?? ""}"></div>
            <div class="row"><label>One-time</label><input name="oneTimePrice" value="${plan.oneTimePrice ?? ""}"></div>
            <div class="row"><label>Currency</label><input name="currency" value="${esc(plan.currency)}"></div>
          </div>
          <div class="row2">
            <div class="row"><label>Badge</label><input name="badge" value="${esc(plan.badge || "")}"></div>
            <div class="row"><label>CTA text</label><input name="ctaText" value="${esc(plan.ctaText || "")}"></div>
            <div class="row"><label>CTA link</label><input name="ctaLink" value="${esc(plan.ctaLink || "")}"></div>
            <div class="row"><label>Color</label><input name="color" value="${esc(plan.color || "")}"></div>
          </div>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="recommended" ${plan.recommended ? "checked" : ""}> Recommended</label>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="popular" ${plan.popular ? "checked" : ""}> Popular</label>
          <button class="btn primary" type="submit">Save</button>
        </form>
      </div>
      <div class="panel">
        <strong>Features</strong>
        <form method="post" action="${R}/catalog/plans/${plan.id}/features" style="margin-top:10px">
          ${csrfField}
          <div class="row"><input name="title" placeholder="Feature title" required></div>
          <div class="row"><input name="valueText" placeholder="Comparison value e.g. 300 / Unlimited"></div>
          <div class="row"><textarea name="description" placeholder="Optional description"></textarea></div>
          <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="included" checked> Included</label>
          <button class="btn sm" type="submit">Add feature</button>
        </form>
        <table class="stack" style="margin-top:12px"><thead><tr><th>Feature</th><th>Included</th><th>Value</th><th></th></tr></thead>
        <tbody>${features
          .map(
            (f) => `<tr>
            <td data-label="Feature">${esc(f.title)}</td>
            <td data-label="Included">${f.included ? "✓" : "—"}</td>
            <td data-label="Value">${esc(f.valueText || "")}</td>
            <td data-label=""><form method="post" action="${R}/catalog/features/${f.id}/delete">${csrfField}<button class="btn danger sm" type="submit">Remove</button></form></td>
          </tr>`
          )
          .join("") || `<tr><td colspan="4" class="muted">No features.</td></tr>`}</tbody></table>
      </div>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/plans/:id`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_plans"), async (req, res) => {
    const id = req.params.id;
    const existing = await catalog.getPlan(id);
    if (!existing) return redirectWith(res, `${R}/catalog/plans`, { error: "Not found" });
    const previousPrice = {
      monthlyPrice: existing.monthlyPrice,
      yearlyPrice: existing.yearlyPrice,
      oneTimePrice: existing.oneTimePrice,
    };
    const data = {
      name: String(req.body.name || "").trim(),
      subtitle: String(req.body.subtitle || "").trim() || null,
      monthlyPrice: numOrNull(req.body.monthlyPrice),
      yearlyPrice: numOrNull(req.body.yearlyPrice),
      oneTimePrice: numOrNull(req.body.oneTimePrice),
      currency: String(req.body.currency || "PKR").trim() || "PKR",
      badge: String(req.body.badge || "").trim() || null,
      ctaText: String(req.body.ctaText || "").trim() || null,
      ctaLink: String(req.body.ctaLink || "").trim() || null,
      color: String(req.body.color || "").trim() || null,
      recommended: bool(req.body.recommended),
      popular: bool(req.body.popular),
      workflowStatus: existing.workflowStatus === "published" ? "draft" : existing.workflowStatus,
    };
    await catalog.updatePlan(id, data);
    audit(req, "PLAN_UPDATED", { targetType: "catalog_plan", targetId: id, previous: previousPrice, next: data });
    if (
      String(previousPrice.monthlyPrice) !== String(data.monthlyPrice) ||
      String(previousPrice.yearlyPrice) !== String(data.yearlyPrice) ||
      String(previousPrice.oneTimePrice) !== String(data.oneTimePrice)
    ) {
      audit(req, "PRICE_CHANGED", { targetType: "catalog_plan", targetId: id, previous: previousPrice, next: data });
    }
    await captureRevision(existing.itemId, req);
    redirectWith(res, `${R}/catalog/plans/${id}`, { notice: "Plan saved." });
  });

  app.post(`${R}/catalog/plans/:id/price`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_plans"), async (req, res) => {
    const id = req.params.id;
    const existing = await catalog.getPlan(id);
    if (!existing) return redirectWith(res, `${R}/catalog/pricing`, { error: "Not found" });
    const previous = {
      monthlyPrice: existing.monthlyPrice,
      yearlyPrice: existing.yearlyPrice,
      oneTimePrice: existing.oneTimePrice,
      currency: existing.currency,
    };
    const next = {
      monthlyPrice: numOrNull(req.body.monthlyPrice),
      yearlyPrice: numOrNull(req.body.yearlyPrice),
      oneTimePrice: numOrNull(req.body.oneTimePrice),
      currency: String(req.body.currency || existing.currency || "PKR"),
      workflowStatus: "draft",
    };
    await catalog.updatePlan(id, next);
    audit(req, "PRICE_CHANGED", { targetType: "catalog_plan", targetId: id, previous, next });
    await captureRevision(existing.itemId, req);
    redirectWith(res, `${R}/catalog/pricing`, { notice: "Price updated (draft). Publish the plan when ready." });
  });

  app.post(`${R}/catalog/plans/:id/workflow`, ...catalogGuard, csrf, authz.requirePermission("catalog.publish"), async (req, res) => {
    const id = req.params.id;
    const action = String(req.body.action || "");
    const existing = await catalog.getPlan(id);
    if (action === "publish") {
      await catalog.updatePlan(id, { workflowStatus: "published", publishedAt: new Date(), publishAt: null });
      audit(req, "PUBLISH_PLAN", { targetType: "catalog_plan", targetId: id });
      if (existing?.itemId) await captureRevision(existing.itemId, req, { summaryHint: `Published plan ${existing.name}` });
    }
    redirectWith(res, `${R}/catalog/plans/${id}`, { notice: "Plan published." });
  });

  app.post(`${R}/catalog/plans/:id/duplicate`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_plans"), async (req, res) => {
    const copy = await catalog.duplicatePlan(req.params.id);
    if (!copy) return redirectWith(res, `${R}/catalog/plans`, { error: "Not found" });
    audit(req, "PLAN_DUPLICATED", { targetType: "catalog_plan", targetId: copy.id });
    await captureRevision(copy.itemId, req, { summaryHint: `Duplicated plan ${copy.name}` });
    redirectWith(res, `${R}/catalog/plans/${copy.id}`, { notice: "Plan duplicated." });
  });

  app.post(`${R}/catalog/plans/:id/features`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_features"), async (req, res) => {
    const planId = req.params.id;
    const title = String(req.body.title || "").trim();
    if (!title) return redirectWith(res, `${R}/catalog/plans/${planId}`, { error: "Title required" });
    const plan = await catalog.getPlan(planId);
    const feature = await catalog.createFeature({
      planId,
      title,
      description: String(req.body.description || "").trim() || null,
      valueText: String(req.body.valueText || "").trim() || null,
      included: bool(req.body.included),
      enabled: true,
    });
    audit(req, "FEATURE_CREATED", { targetType: "plan_feature", targetId: feature.id, next: { title, planId } });
    if (plan?.itemId) await captureRevision(plan.itemId, req, { summaryHint: `Added ${title}` });
    redirectWith(res, `${R}/catalog/plans/${planId}`, { notice: "Feature added." });
  });

  app.post(`${R}/catalog/features/:id/delete`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_features"), async (req, res) => {
    const feature = await catalog.prisma.planFeature.findFirst({
      where: { id: req.params.id },
      include: { plan: true },
    });
    await catalog.softDeleteFeature(req.params.id);
    audit(req, "FEATURE_DELETED", { targetType: "plan_feature", targetId: req.params.id });
    if (feature?.plan?.itemId) {
      await captureRevision(feature.plan.itemId, req, { summaryHint: `Removed ${feature.title || "feature"}` });
    }
    redirectWith(res, `${R}/catalog/plans/${feature?.planId || ""}`, { notice: "Feature removed." });
  });

  /* ---------- Media ---------- */
  app.post(
    `${R}/catalog/:id/media`,
    ...catalogGuard,
    csrf,
    authz.requirePermission("catalog.upload"),
    (req, res) => {
      upload.single("file")(req, res, async (err) => {
        if (err) return redirectWith(res, `${R}/catalog/${req.params.id}`, { error: err.message || "Upload failed" });
        if (!req.file) return redirectWith(res, `${R}/catalog/${req.params.id}`, { error: "File required" });
        const rel = `/uploads/catalog/${req.params.id}/${req.file.filename}`;
        const media = await catalog.createMedia({
          itemId: req.params.id,
          mediaType: String(req.body.mediaType || "gallery"),
          url: rel,
          alt: String(req.body.alt || "").trim() || null,
        });
        audit(req, "MEDIA_UPLOADED", { targetType: "catalog_media", targetId: media.id, next: { url: rel } });
        redirectWith(res, `${R}/catalog/${req.params.id}`, { notice: "Media uploaded." });
      });
    }
  );

  app.post(`${R}/catalog/media/:id/delete`, ...catalogGuard, csrf, authz.requirePermission("catalog.manage_media"), async (req, res) => {
    const media = await catalog.prisma.catalogMedia.findFirst({ where: { id: req.params.id } });
    await catalog.softDeleteMedia(req.params.id);
    audit(req, "MEDIA_DELETED", { targetType: "catalog_media", targetId: req.params.id });
    redirectWith(res, `${R}/catalog/${media?.itemId || ""}`, { notice: "Media removed." });
  });

  /* ---------- Changelog ---------- */
  app.post(`${R}/catalog/:id/changelog`, ...catalogGuard, csrf, authz.requirePermission("catalog.update"), async (req, res) => {
    const entry = await catalog.createChangelog({
      itemId: req.params.id,
      version: String(req.body.version || "").trim(),
      title: String(req.body.title || "").trim(),
      body: String(req.body.body || "").trim(),
      visibleWebsite: true,
    });
    audit(req, "CHANGELOG_CREATED", { targetType: "catalog_changelog", targetId: entry.id });
    redirectWith(res, `${R}/catalog/${req.params.id}`, { notice: "Changelog entry added." });
  });

  /* ---------- Campaigns (legacy) → Marketing Campaign Manager ---------- */
  app.get(`${R}/catalog/campaigns`, ...catalogGuard, (req, res) => {
    res.redirect(`${R}/catalog/marketing`);
  });
  app.post(`${R}/catalog/campaigns`, ...catalogGuard, (req, res) => {
    res.redirect(`${R}/catalog/marketing`);
  });

  /* ---------- Version history ---------- */
  app.get(`${R}/catalog/:id/versions`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const item = await catalog.getItem(req.params.id, { admin: true });
    if (!item || item.deletedAt) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    await versioning.ensureBaseline(item.id, { req, summaryHint: "Initial Release" });
    const revisions = await versioning.listRevisions(item.id);
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>Version History</strong><div class="muted">${esc(item.name)}</div></div>
        <a class="btn sm" href="${R}/catalog/${item.id}">Back to product</a>
      </div>
      ${
        revisions.length >= 2
          ? `<form class="toolbar" method="get" action="${R}/catalog/${item.id}/versions/compare">
        <label>Compare</label>
        <select name="a">${revisions.map((r) => `<option value="${r.versionNumber}">v${r.versionNumber} — ${esc(r.summary)}</option>`).join("")}</select>
        <select name="b">${revisions.map((r, i) => `<option value="${r.versionNumber}" ${i === 0 ? "selected" : ""}>v${r.versionNumber} — ${esc(r.summary)}</option>`).join("")}</select>
        <button class="btn sm" type="submit">Compare</button>
      </form>`
          : ""
      }
      <table class="stack" style="margin-top:12px"><thead><tr><th>Version</th><th>Summary</th><th>Created By</th><th>Created Date</th><th>Status</th><th></th></tr></thead>
      <tbody>${revisions
        .map(
          (r) => `<tr>
          <td data-label="Version">v${r.versionNumber}</td>
          <td data-label="Summary">${esc(r.summary)}${r.restoredFromVersion != null ? ` <span class="muted">(from v${r.restoredFromVersion})</span>` : ""}</td>
          <td data-label="Created By">${esc(r.createdByEmail || "—")}</td>
          <td data-label="Created Date">${esc(String(r.createdAt).slice(0, 19).replace("T", " "))}</td>
          <td data-label="Status">${r.status === "current" ? '<span class="badge">Current</span>' : esc(r.status)}</td>
          <td data-label="">
            <a class="btn sm" href="${R}/catalog/${item.id}/versions/${r.versionNumber}">View</a>
            ${
              r.status !== "current"
                ? `<form method="post" action="${R}/catalog/${item.id}/versions/${r.versionNumber}/restore" style="display:inline" onsubmit="return confirm('Restore version ${r.versionNumber}? The live website will update immediately.');">${csrfField}<button class="btn sm" type="submit">Restore</button></form>`
                : ""
            }
          </td>
        </tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No versions.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/:id/versions/compare`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const item = await catalog.getItem(req.params.id, { admin: true });
    if (!item) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const a = Number(req.query.a);
    const b = Number(req.query.b);
    const [revA, revB] = await Promise.all([versioning.getRevision(item.id, a), versioning.getRevision(item.id, b)]);
    if (!revA || !revB) return redirectWith(res, `${R}/catalog/${item.id}/versions`, { error: "Select two valid versions" });
    const changes = versioning.compareSnapshots(revA.snapshotJson, revB.snapshotJson);
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>Compare versions</strong><div class="muted">${esc(item.name)} — v${a} → v${b}</div></div>
        <a class="btn sm" href="${R}/catalog/${item.id}/versions">Back</a>
      </div>
      <p class="muted">Highlights what differs between v${a} (${esc(revA.summary)}) and v${b} (${esc(revB.summary)}).</p>
      ${renderChangeRows(changes)}
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/:id/versions/:n`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    if (req.params.n === "compare") return res.status(404).send("Not found");
    const item = await catalog.getItem(req.params.id, { admin: true });
    if (!item) return redirectWith(res, `${R}/catalog`, { error: "Not found" });
    const rev = await versioning.getRevision(item.id, Number(req.params.n));
    if (!rev) return redirectWith(res, `${R}/catalog/${item.id}/versions`, { error: "Version not found" });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const snap = rev.snapshotJson || {};
    const plans = snap.plans || [];
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div>
          <strong>Version ${rev.versionNumber}</strong>
          ${rev.status === "current" ? ' <span class="badge">Current</span>' : ""}
          <div class="muted">${esc(rev.summary)} · ${esc(rev.createdByEmail || "—")} · ${esc(String(rev.createdAt).slice(0, 19).replace("T", " "))}</div>
        </div>
        <div class="actions">
          <a class="btn sm" href="${R}/catalog/${item.id}/versions">History</a>
          ${
            rev.status !== "current"
              ? `<form method="post" action="${R}/catalog/${item.id}/versions/${rev.versionNumber}/restore" onsubmit="return confirm('Restore version ${rev.versionNumber}? Live site will update immediately.');">${csrfField}
            <input name="reason" placeholder="Optional reason" style="margin-right:8px">
            <button class="btn primary sm" type="submit">Restore this version</button>
          </form>`
              : ""
          }
        </div>
      </div>
      ${rev.reason ? `<p class="muted">Reason: ${esc(rev.reason)}</p>` : ""}
      <h3 style="margin-top:16px">What changed</h3>
      ${renderChangeRows(rev.changes || [])}
      <h3 style="margin-top:16px">Snapshot plans</h3>
      <ul>${plans
        .map(
          (p) =>
            `<li><strong>${esc(p.name)}</strong> — ${
              p.monthlyPrice != null ? `${esc(p.currency || "PKR")} ${esc(String(p.monthlyPrice))}/mo` : p.oneTimePrice != null ? `${esc(p.currency || "PKR")} ${esc(String(p.oneTimePrice))}` : "Custom"
            } ${p.badge ? `(${esc(p.badge)})` : ""} · ${(p.features || []).length} features</li>`
        )
        .join("") || "<li class='muted'>No plans in snapshot.</li>"}</ul>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.post(`${R}/catalog/:id/versions/:n/restore`, ...catalogGuard, csrf, authz.requirePermission("catalog.publish"), async (req, res) => {
    const itemId = req.params.id;
    const n = Number(req.params.n);
    try {
      await versioning.restoreVersion(itemId, n, {
        req,
        reason: String(req.body.reason || "").trim() || null,
      });
      redirectWith(res, `${R}/catalog/${itemId}/versions`, {
        notice: `Restored version ${n}. Live catalog published as a new version.`,
      });
    } catch (err) {
      redirectWith(res, `${R}/catalog/${itemId}/versions`, { error: err.message || "Restore failed" });
    }
  });

  /* ---------- Notify interests ---------- */
  app.get(`${R}/catalog/notify`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const rows = await catalog.listNotifyInterests();
    const canExport = true;
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head"><strong>Notify Me leads</strong>
        ${canExport ? `<a class="btn sm" href="${R}/catalog/notify/export.csv">Export CSV</a>` : ""}
      </div>
      <table class="stack"><thead><tr><th>When</th><th>Product</th><th>Name</th><th>Email</th><th>WhatsApp</th><th>Campaign</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
          <td data-label="When">${esc(String(r.createdAt).slice(0, 19).replace("T", " "))}</td>
          <td data-label="Product">${esc(r.item?.name || "")}</td>
          <td data-label="Name">${esc(r.name || "")}</td>
          <td data-label="Email">${esc(r.email || "")}</td>
          <td data-label="WhatsApp">${esc(r.whatsapp || "")}</td>
          <td data-label="Campaign">${esc(r.campaignSlug || "")}</td>
        </tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No interest signups yet.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Catalog Manager", inner, req));
  });

  app.get(`${R}/catalog/notify/export.csv`, ...catalogGuard, authz.requirePermission("catalog.view"), async (req, res) => {
    const rows = await catalog.listNotifyInterests();
    const header = "created_at,product,name,email,whatsapp,campaign,source_page,lead_id\n";
    const body = rows
      .map((r) =>
        [r.createdAt.toISOString(), r.item?.name, r.name, r.email, r.whatsapp, r.campaignSlug, r.sourcePage, r.leadId]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=catalog-notify.csv");
    res.send(header + body);
  });

  app.get(`${R}/catalog/downloads`, ...catalogGuard, (req, res) => {
    res.send(portalShell("Catalog Manager", `${flash(req)}<div class="panel"><strong>Downloads</strong><p class="muted">Coming in a future phase.</p></div>`, req));
  });
  app.get(`${R}/catalog/licenses`, ...catalogGuard, (req, res) => {
    res.send(portalShell("Catalog Manager", `${flash(req)}<div class="panel"><strong>Licenses</strong><p class="muted">Coming in a future phase.</p></div>`, req));
  });
};
