/**
 * Super Admin Promotions Manager — discount codes under Catalog Manager.
 */
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const authz = require("./authz");
const { PromotionRepository: promotions } = require("./db/repositories/promotions");
const { CatalogRepository: catalog } = require("./db/repositories/catalog");

const { esc } = views;
const R = config.portalRoute;
const guard = [authz.requireAuth, authz.requireActiveUser, authz.requireSuperAdmin];

function flash(req) {
  const notice = req.query.notice ? `<div class="notice">${esc(req.query.notice)}</div>` : "";
  const error = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : "";
  return notice + error;
}

function redirectWith(res, pathName, params) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${pathName}${qs ? `?${qs}` : ""}`);
}

function bool(v) {
  return v === "on" || v === "true" || v === true || v === "1";
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusBadge(status) {
  const map = { active: "ok", paused: "warn", expired: "warn", archived: "" };
  return `<span class="badge ${map[status] || ""}">${esc(status || "")}</span>`;
}

function multiSelect(name, options, selectedIds) {
  const selected = new Set(selectedIds || []);
  return `<select name="${name}" multiple size="6" style="min-height:120px">${options
    .map((o) => `<option value="${esc(o.id)}" ${selected.has(o.id) ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("")}</select>
  <p class="muted" style="margin:4px 0 0;font-size:12px">Leave empty to apply to all. Hold Ctrl/Cmd to multi-select.</p>`;
}

function bodyToPromo(body) {
  return {
    name: String(body.name || "").trim(),
    code: String(body.code || "").trim(),
    description: String(body.description || "").trim() || null,
    internalNotes: String(body.internalNotes || "").trim() || null,
    discountType: String(body.discountType || "percentage"),
    discountValue: numOrNull(body.discountValue),
    maxUses: numOrNull(body.maxUses),
    usesPerCustomer: numOrNull(body.usesPerCustomer) ?? 1,
    startsAt: parseDate(body.startsAt),
    endsAt: parseDate(body.endsAt),
    autoExpire: bool(body.autoExpire),
    status: String(body.status || "active"),
    minPurchaseAmount: numOrNull(body.minPurchaseAmount),
    maxDiscountAmount: numOrNull(body.maxDiscountAmount),
    currency: String(body.currency || "PKR").trim() || "PKR",
  };
}

function selectedIds(body, key) {
  const raw = body[key];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String).filter(Boolean);
}

module.exports = function registerPromotionRoutes({ app, csrf, token, portalShell }) {
  app.get(`${R}/catalog/promotions`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    try {
      const status = String(req.query.status || "");
      const q = String(req.query.q || "").trim();
      const [rows, stats] = await Promise.all([
        promotions.list({ status: status || undefined, q: q || undefined }),
        promotions.analytics(),
      ]);
      const canManage = authz.can(req, "catalog.manage_promotions");
      const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
      const inner = `${flash(req)}
      <div class="grid cards" style="margin-bottom:12px">
        <div class="card"><div class="k">Active</div><div class="v">${stats.active}</div></div>
        <div class="card"><div class="k">Expired</div><div class="v">${stats.expired}</div></div>
        <div class="card"><div class="k">Redemptions</div><div class="v">${stats.redemptionCount}</div></div>
        <div class="card"><div class="k">Discounts given</div><div class="v">${Math.round(stats.totalDiscount).toLocaleString()}</div></div>
        <div class="card"><div class="k">Revenue (final)</div><div class="v">${Math.round(stats.totalRevenue).toLocaleString()}</div></div>
        <div class="card"><div class="k">Conversion</div><div class="v">${stats.conversionRate}%</div></div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div><strong>Promotions</strong><div class="muted">Discount codes for catalog products &amp; plans</div></div>
          ${canManage ? `<a class="btn primary sm" href="${R}/catalog/promotions/new">Create promotion</a>` : ""}
        </div>
        <form class="toolbar" method="get">
          <input name="q" value="${esc(q)}" placeholder="Search name or code">
          <select name="status">
            <option value="">All statuses</option>
            ${["active", "paused", "expired", "archived"]
              .map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <button class="btn sm" type="submit">Filter</button>
        </form>
        ${
          stats.mostUsed?.length
            ? `<p class="muted" style="margin-top:8px">Most used: ${stats.mostUsed
                .map((m) => `<strong>${esc(m.code)}</strong> (${m.usedCount})`)
                .join(" · ")}</p>`
            : ""
        }
        <table class="stack" style="margin-top:12px"><thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Value</th><th>Uses</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (p) => `<tr>
            <td data-label="Name">${esc(p.name)}</td>
            <td data-label="Code"><code>${esc(p.code)}</code></td>
            <td data-label="Type">${esc(p.discountType)}</td>
            <td data-label="Value">${p.discountType === "percentage" ? `${esc(String(p.discountValue))}%` : `${esc(p.currency)} ${esc(String(p.discountValue))}`}</td>
            <td data-label="Uses">${p.usedCount}${p.maxUses != null ? ` / ${p.maxUses}` : ""}</td>
            <td data-label="Status">${statusBadge(p.status)}</td>
            <td data-label=""><a class="btn sm" href="${R}/catalog/promotions/${p.id}">Open</a></td>
          </tr>`
          )
          .join("") || `<tr><td colspan="7" class="muted">No promotions yet.</td></tr>`}</tbody></table>
      </div>`;
      res.send(portalShell("Promotions", inner, req));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[promotions]", err);
      res.send(portalShell("Promotions", `<div class="error">Failed to load promotions.</div>`, req));
    }
  });

  app.get(`${R}/catalog/promotions/new`, ...guard, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    const items = await catalog.listItems({ admin: true });
    const plans = items.flatMap((i) => (i.plans || []).map((p) => ({ id: p.id, label: `${i.name} · ${p.name}` })));
    const productOpts = items.map((i) => ({ id: i.id, label: i.name }));
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel">
      <strong>Create promotion</strong>
      <form method="post" action="${R}/catalog/promotions" style="margin-top:12px">
        ${csrfField}
        <div class="row2">
          <div class="row"><label>Name</label><input name="name" required></div>
          <div class="row"><label>Discount code</label><input name="code" required placeholder="WELCOME10"></div>
        </div>
        <div class="row"><label>Description</label><textarea name="description"></textarea></div>
        <div class="row2">
          <div class="row"><label>Type</label><select name="discountType">
            <option value="percentage">Percentage</option>
            <option value="flat">Flat</option>
            <option value="trial_extension">Free Trial Extension (future)</option>
            <option value="free_setup">Free Setup (future)</option>
            <option value="bundle">Bundle Discount (future)</option>
          </select></div>
          <div class="row"><label>Value</label><input name="discountValue" required placeholder="10 or 5000"></div>
          <div class="row"><label>Currency</label><input name="currency" value="PKR"></div>
          <div class="row"><label>Status</label><select name="status"><option value="active">active</option><option value="paused">paused</option></select></div>
        </div>
        <div class="row2">
          <div class="row"><label>Max uses</label><input name="maxUses" type="number" min="0"></div>
          <div class="row"><label>Uses per customer</label><input name="usesPerCustomer" type="number" min="0" value="1"></div>
          <div class="row"><label>Min purchase</label><input name="minPurchaseAmount"></div>
          <div class="row"><label>Max discount</label><input name="maxDiscountAmount"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Starts</label><input type="datetime-local" name="startsAt"></div>
          <div class="row"><label>Ends</label><input type="datetime-local" name="endsAt"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="autoExpire" checked> Auto expire when end date passes</label>
        <div class="row2" style="margin-top:12px">
          <div class="row"><label>Applicable products</label>${multiSelect("productIds", productOpts, [])}</div>
          <div class="row"><label>Applicable plans</label>${multiSelect("planIds", plans, [])}</div>
        </div>
        <div class="row"><label>Internal notes</label><textarea name="internalNotes"></textarea></div>
        <button class="btn primary" type="submit">Create</button>
        <a class="btn" href="${R}/catalog/promotions">Cancel</a>
      </form>
    </div>`;
    res.send(portalShell("Promotions", inner, req));
  });

  app.post(`${R}/catalog/promotions`, ...guard, csrf, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    try {
      const data = bodyToPromo(req.body);
      if (!data.name || !data.code || data.discountValue == null) {
        return redirectWith(res, `${R}/catalog/promotions/new`, { error: "Name, code, and value are required." });
      }
      const row = await promotions.create(data, {
        productIds: selectedIds(req.body, "productIds"),
        planIds: selectedIds(req.body, "planIds"),
      });
      audit(req, "PROMOTION_CREATED", { targetType: "promotion", targetId: row.id, next: { code: row.code, name: row.name } });
      redirectWith(res, `${R}/catalog/promotions/${row.id}`, { notice: "Promotion created." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/promotions/new`, { error: err.message || "Could not create." });
    }
  });

  app.get(`${R}/catalog/promotions/:id`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    if (req.params.id === "new") return;
    const promo = await promotions.get(req.params.id);
    if (!promo) return redirectWith(res, `${R}/catalog/promotions`, { error: "Not found" });
    const items = await catalog.listItems({ admin: true });
    const plans = items.flatMap((i) => (i.plans || []).map((p) => ({ id: p.id, label: `${i.name} · ${p.name}` })));
    const productOpts = items.map((i) => ({ id: i.id, label: i.name }));
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const canManage = authz.can(req, "catalog.manage_promotions");
    const productIds = (promo.products || []).map((p) => p.itemId);
    const planIds = (promo.plans || []).map((p) => p.planId);
    const toLocal = (d) => (d ? esc(new Date(d).toISOString().slice(0, 16)) : "");

    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>${esc(promo.name)}</strong> ${statusBadge(promo.status)}<div class="muted"><code>${esc(promo.code)}</code> · used ${promo.usedCount}${promo.maxUses != null ? ` / ${promo.maxUses}` : ""}</div></div>
        <div class="actions">
          <a class="btn sm" href="${R}/catalog/promotions">All</a>
          ${
            canManage
              ? `
            <form method="post" action="${R}/catalog/promotions/${promo.id}/duplicate" style="display:inline">${csrfField}<button class="btn sm" type="submit">Duplicate</button></form>
            ${
              promo.status === "active"
                ? `<form method="post" action="${R}/catalog/promotions/${promo.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="paused"><button class="btn sm" type="submit">Pause</button></form>`
                : `<form method="post" action="${R}/catalog/promotions/${promo.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="active"><button class="btn primary sm" type="submit">Activate</button></form>`
            }
            <form method="post" action="${R}/catalog/promotions/${promo.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="archived"><button class="btn sm" type="submit">Archive</button></form>
            <form method="post" action="${R}/catalog/promotions/${promo.id}/delete" style="display:inline" onsubmit="return confirm('Delete this promotion?');">${csrfField}<button class="btn danger sm" type="submit">Delete</button></form>`
              : ""
          }
        </div>
      </div>
      ${
        canManage
          ? `<form method="post" action="${R}/catalog/promotions/${promo.id}">
        ${csrfField}
        <div class="row2">
          <div class="row"><label>Name</label><input name="name" value="${esc(promo.name)}" required></div>
          <div class="row"><label>Discount code</label><input name="code" value="${esc(promo.code)}" required></div>
        </div>
        <div class="row"><label>Description</label><textarea name="description">${esc(promo.description || "")}</textarea></div>
        <div class="row2">
          <div class="row"><label>Type</label><select name="discountType">
            ${["percentage", "flat", "trial_extension", "free_setup", "bundle"]
              .map((t) => `<option value="${t}" ${promo.discountType === t ? "selected" : ""}>${t}</option>`)
              .join("")}
          </select></div>
          <div class="row"><label>Value</label><input name="discountValue" value="${promo.discountValue ?? ""}" required></div>
          <div class="row"><label>Currency</label><input name="currency" value="${esc(promo.currency)}"></div>
          <div class="row"><label>Status</label><select name="status">${["active", "paused", "expired", "archived"]
            .map((s) => `<option value="${s}" ${promo.status === s ? "selected" : ""}>${s}</option>`)
            .join("")}</select></div>
        </div>
        <div class="row2">
          <div class="row"><label>Max uses</label><input name="maxUses" type="number" value="${promo.maxUses ?? ""}"></div>
          <div class="row"><label>Uses per customer</label><input name="usesPerCustomer" type="number" value="${promo.usesPerCustomer ?? 1}"></div>
          <div class="row"><label>Min purchase</label><input name="minPurchaseAmount" value="${promo.minPurchaseAmount ?? ""}"></div>
          <div class="row"><label>Max discount</label><input name="maxDiscountAmount" value="${promo.maxDiscountAmount ?? ""}"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Starts</label><input type="datetime-local" name="startsAt" value="${toLocal(promo.startsAt)}"></div>
          <div class="row"><label>Ends</label><input type="datetime-local" name="endsAt" value="${toLocal(promo.endsAt)}"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="autoExpire" ${promo.autoExpire ? "checked" : ""}> Auto expire</label>
        <div class="row2" style="margin-top:12px">
          <div class="row"><label>Applicable products</label>${multiSelect("productIds", productOpts, productIds)}</div>
          <div class="row"><label>Applicable plans</label>${multiSelect("planIds", plans, planIds)}</div>
        </div>
        <div class="row"><label>Internal notes</label><textarea name="internalNotes">${esc(promo.internalNotes || "")}</textarea></div>
        <button class="btn primary" type="submit">Save</button>
      </form>`
          : `<p class="muted">${esc(promo.description || "")}</p>`
      }
      <h3 style="margin-top:20px">Recent redemptions</h3>
      <table class="stack"><thead><tr><th>When</th><th>Code</th><th>Original</th><th>Discount</th><th>Final</th><th>Customer</th></tr></thead>
      <tbody>${(promo.redemptions || [])
        .map(
          (r) => `<tr>
          <td data-label="When">${esc(String(r.createdAt).slice(0, 19).replace("T", " "))}</td>
          <td data-label="Code">${esc(r.code)}</td>
          <td data-label="Original">${esc(String(r.originalAmount))}</td>
          <td data-label="Discount">${esc(String(r.discountAmount))}</td>
          <td data-label="Final">${esc(String(r.finalAmount))}</td>
          <td data-label="Customer">${esc(r.customerEmail || r.customerWhatsapp || "—")}</td>
        </tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No redemptions yet.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Promotions", inner, req));
  });

  app.post(`${R}/catalog/promotions/:id`, ...guard, csrf, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    try {
      const data = bodyToPromo(req.body);
      await promotions.update(req.params.id, data, {
        productIds: selectedIds(req.body, "productIds"),
        planIds: selectedIds(req.body, "planIds"),
      });
      audit(req, "PROMOTION_UPDATED", { targetType: "promotion", targetId: req.params.id, next: { code: data.code } });
      redirectWith(res, `${R}/catalog/promotions/${req.params.id}`, { notice: "Promotion updated." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/promotions/${req.params.id}`, { error: err.message || "Update failed" });
    }
  });

  app.post(`${R}/catalog/promotions/:id/status`, ...guard, csrf, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    const status = String(req.body.status || "");
    await promotions.setStatus(req.params.id, status);
    const action =
      status === "paused"
        ? "PROMOTION_PAUSED"
        : status === "active"
          ? "PROMOTION_ACTIVATED"
          : status === "archived"
            ? "PROMOTION_ARCHIVED"
            : "PROMOTION_UPDATED";
    audit(req, action, { targetType: "promotion", targetId: req.params.id, next: { status } });
    redirectWith(res, `${R}/catalog/promotions/${req.params.id}`, { notice: `Marked ${status}.` });
  });

  app.post(`${R}/catalog/promotions/:id/duplicate`, ...guard, csrf, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    const copy = await promotions.duplicate(req.params.id);
    if (!copy) return redirectWith(res, `${R}/catalog/promotions`, { error: "Not found" });
    audit(req, "PROMOTION_DUPLICATED", { targetType: "promotion", targetId: copy.id });
    redirectWith(res, `${R}/catalog/promotions/${copy.id}`, { notice: "Promotion duplicated (paused)." });
  });

  app.post(`${R}/catalog/promotions/:id/delete`, ...guard, csrf, authz.requirePermission("catalog.manage_promotions"), async (req, res) => {
    await promotions.softDelete(req.params.id);
    audit(req, "PROMOTION_DELETED", { targetType: "promotion", targetId: req.params.id });
    redirectWith(res, `${R}/catalog/promotions`, { notice: "Promotion deleted." });
  });
};
