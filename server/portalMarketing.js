/**
 * Marketing Campaign Manager — Super Admin portal.
 */
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const authz = require("./authz");
const { MarketingCampaignRepository: campaigns } = require("./db/repositories/marketingCampaigns");
const { CatalogRepository: catalog } = require("./db/repositories/catalog");
const { PromotionRepository: promotions } = require("./db/repositories/promotions");

const { esc } = views;
const R = config.portalRoute;
const guard = [authz.requireAuth, authz.requireActiveUser, authz.requireSuperAdmin];

const CAMPAIGN_TYPES = [
  "percentage_discount",
  "flat_discount",
  "launch_offer",
  "holiday_sale",
  "back_to_school",
  "black_friday",
  "ramadan_offer",
  "new_year_sale",
  "limited_time",
  "referral",
  "custom",
];

const STATUSES = ["draft", "scheduled", "published", "paused", "expired", "archived"];
const PLACEMENTS = ["top_bar", "hero_banner", "floating_card", "sticky_bottom"];
const SCOPES = ["entire_website", "homepage_only", "product_pages", "specific_product", "multiple_pages"];
const AUDIENCES = ["all", "returning", "new", "existing_customers", "logged_in"];

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

const { zonedLocalToUtc, utcToZonedLocalInput, normalizeTimezone, DEFAULT_TZ } = require("./shared/timezone");

function bool(v) {
  return v === "on" || v === "true" || v === true || v === "1";
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v, timezone) {
  if (!v) return null;
  return zonedLocalToUtc(v, timezone || DEFAULT_TZ);
}

function toLocal(d, timezone) {
  return d ? utcToZonedLocalInput(d, timezone || DEFAULT_TZ) : "";
}

function statusBadge(status) {
  const map = { published: "ok", scheduled: "", paused: "warn", expired: "warn", draft: "", archived: "" };
  return `<span class="badge ${map[status] || ""}">${esc(status || "")}</span>`;
}

function multiSelect(name, options, selectedIds) {
  const selected = new Set(selectedIds || []);
  return `<select name="${name}" multiple size="5" style="min-height:100px">${options
    .map((o) => `<option value="${esc(o.id)}" ${selected.has(o.id) ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("")}</select>
  <p class="muted" style="font-size:12px;margin:4px 0 0">Empty = no restriction. Ctrl/Cmd multi-select.</p>`;
}

function selectedIds(body, key) {
  const raw = body[key];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String).filter(Boolean);
}

function bodyToCampaign(body) {
  const timezone = normalizeTimezone(body.timezone || DEFAULT_TZ);
  return {
    name: String(body.name || "").trim(),
    slug: String(body.slug || body.name || "").trim(),
    internalNotes: String(body.internalNotes || "").trim() || null,
    campaignType: String(body.campaignType || "custom"),
    status: String(body.status || "draft"),
    headline: String(body.headline || "").trim() || null,
    subHeading: String(body.subHeading || "").trim() || null,
    description: String(body.description || "").trim() || null,
    promotionBadge: String(body.promotionBadge || "").trim() || null,
    buttonText: String(body.buttonText || "").trim() || null,
    buttonLink: String(body.buttonLink || "").trim() || null,
    bannerImageUrl: String(body.bannerImageUrl || "").trim() || null,
    backgroundImageUrl: String(body.backgroundImageUrl || "").trim() || null,
    themeColor: String(body.themeColor || "").trim() || null,
    accentColor: String(body.accentColor || "").trim() || null,
    icon: String(body.icon || "").trim() || null,
    animationStyle: String(body.animationStyle || "").trim() || null,
    discountType: String(body.discountType || "").trim() || null,
    discountValue: numOrNull(body.discountValue),
    discountCode: String(body.discountCode || "").trim().toUpperCase().replace(/\s+/g, "") || null,
    autoApplyDiscount: bool(body.autoApplyDiscount),
    promotionId: String(body.promotionId || "").trim() || null,
    startsAt: parseDate(body.startsAt, timezone),
    endsAt: parseDate(body.endsAt, timezone),
    timezone,
    showCountdown: bool(body.showCountdown),
    bannerPlacement: String(body.bannerPlacement || "top_bar"),
    bannerScope: String(body.bannerScope || "entire_website"),
    dismissible: bool(body.dismissible),
    persistent: bool(body.persistent),
    animated: bool(body.animated),
    audience: String(body.audience || "all"),
    utmSource: String(body.utmSource || "").trim() || null,
    utmMedium: String(body.utmMedium || "").trim() || null,
    utmCampaign: String(body.utmCampaign || "").trim() || null,
  };
}

function previewHtml(c) {
  const theme = esc(c.themeColor || "#0f172a");
  const accent = esc(c.accentColor || "#2563EB");
  return `<div class="panel" id="campaignPreview">
    <strong>Live preview</strong>
    <div style="margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,.08)">
      <div id="previewBar" style="background:${theme};color:#fff;padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between">
        <div>
          <span id="previewBadge" style="background:${accent};padding:2px 8px;border-radius:999px;font-size:11px;display:${c.promotionBadge ? "inline-block" : "none"}">${esc(c.promotionBadge || "Badge")}</span>
          <div id="previewHeadline" style="font-weight:700;margin-top:4px">${esc(c.headline || c.name || "Headline")}</div>
          <div id="previewSub" style="opacity:.85;font-size:13px">${esc(c.subHeading || "")}</div>
        </div>
        <a id="previewBtn" class="btn sm" style="background:${accent};color:#fff;border:0" href="${esc(c.buttonLink || "#")}">${esc(c.buttonText || "Learn more")}</a>
      </div>
      <div id="previewCountdown" class="muted" style="padding:8px 12px;display:${c.showCountdown && c.endsAt ? "block" : "none"}">Countdown to ${esc(c.endsAt ? String(c.endsAt).slice(0, 16) : "")}</div>
      <div id="previewDiscount" style="padding:8px 12px;display:${c.discountValue != null ? "block" : "none"}">Discount: ${esc(c.discountType || "")} ${esc(c.discountValue != null ? String(c.discountValue) : "")}${c.autoApplyDiscount ? " · Auto-apply" : c.discountCode ? ` · Code ${esc(c.discountCode)}` : ""}</div>
    </div>
  </div>
  <script>
  (function(){
    var form = document.querySelector('form[action*="marketing"]');
    if(!form) return;
    function val(name){var el=form.querySelector('[name="'+name+'"]'); if(!el) return ''; if(el.type==='checkbox') return el.checked; return el.value||'';}
    function sync(){
      var theme=val('themeColor')||'#0f172a';
      var accent=val('accentColor')||'#2563EB';
      var badge=val('promotionBadge');
      var bar=document.getElementById('previewBar');
      var badgeEl=document.getElementById('previewBadge');
      var btn=document.getElementById('previewBtn');
      if(bar) bar.style.background=theme;
      if(badgeEl){ badgeEl.style.background=accent; badgeEl.style.display=badge?'inline-block':'none'; badgeEl.textContent=badge||'Badge'; }
      var h=document.getElementById('previewHeadline'); if(h) h.textContent=val('headline')||val('name')||'Headline';
      var s=document.getElementById('previewSub'); if(s) s.textContent=val('subHeading');
      if(btn){ btn.style.background=accent; btn.textContent=val('buttonText')||'Learn more'; btn.href=val('buttonLink')||'#'; }
      var cd=document.getElementById('previewCountdown');
      if(cd){ var show=val('showCountdown') && val('endsAt'); cd.style.display=show?'block':'none'; if(show) cd.textContent='Countdown to '+String(val('endsAt')).slice(0,16); }
      var disc=document.getElementById('previewDiscount');
      if(disc){
        var dv=val('discountValue');
        disc.style.display=dv!==''?'block':'none';
        if(dv!==''){
          var auto=val('autoApplyDiscount');
          var code=val('discountCode');
          disc.textContent='Discount: '+val('discountType')+' '+dv+(auto?' · Auto-apply':(code?' · Code '+code:''));
        }
      }
    }
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
  })();
  </script>`;
}

function formFields(c, { productOpts, planOpts, categoryOpts, promoOpts, csrfField }) {
  const productIds = (c.products || []).map((p) => p.itemId);
  const planIds = (c.plans || []).map((p) => p.planId);
  const categoryIds = (c.categories || []).map((x) => x.categoryId);
  return `${csrfField}
    <div class="row2">
      <div class="row"><label>Name</label><input name="name" value="${esc(c.name || "")}" required></div>
      <div class="row"><label>Slug</label><input name="slug" value="${esc(c.slug || "")}"></div>
    </div>
    <div class="row2">
      <div class="row"><label>Type</label><select name="campaignType">${CAMPAIGN_TYPES.map(
        (t) => `<option value="${t}" ${c.campaignType === t ? "selected" : ""}>${t.replace(/_/g, " ")}</option>`
      ).join("")}</select></div>
      <div class="row"><label>Status</label><select name="status">${STATUSES.map(
        (s) => `<option value="${s}" ${c.status === s ? "selected" : ""}>${s}</option>`
      ).join("")}</select></div>
    </div>
    <div class="row"><label>Headline</label><input name="headline" value="${esc(c.headline || "")}"></div>
    <div class="row"><label>Sub heading</label><input name="subHeading" value="${esc(c.subHeading || "")}"></div>
    <div class="row"><label>Description</label><textarea name="description">${esc(c.description || "")}</textarea></div>
    <div class="row2">
      <div class="row"><label>Badge</label><input name="promotionBadge" value="${esc(c.promotionBadge || "")}"></div>
      <div class="row"><label>Button text</label><input name="buttonText" value="${esc(c.buttonText || "")}"></div>
      <div class="row"><label>Button link</label><input name="buttonLink" value="${esc(c.buttonLink || "")}"></div>
    </div>
    <div class="row2">
      <div class="row"><label>Banner image URL</label><input name="bannerImageUrl" value="${esc(c.bannerImageUrl || "")}"></div>
      <div class="row"><label>Background image URL</label><input name="backgroundImageUrl" value="${esc(c.backgroundImageUrl || "")}"></div>
    </div>
    <div class="row2">
      <div class="row"><label>Theme color</label><input name="themeColor" value="${esc(c.themeColor || "#0f172a")}"></div>
      <div class="row"><label>Accent color</label><input name="accentColor" value="${esc(c.accentColor || "#2563EB")}"></div>
      <div class="row"><label>Icon</label><input name="icon" value="${esc(c.icon || "")}"></div>
      <div class="row"><label>Animation</label><input name="animationStyle" value="${esc(c.animationStyle || "fade")}"></div>
    </div>
    <h3 style="margin-top:16px">Discount</h3>
    <div class="row2">
      <div class="row"><label>Discount type</label><select name="discountType">
        <option value="">None</option>
        <option value="percentage" ${c.discountType === "percentage" ? "selected" : ""}>Percentage</option>
        <option value="flat" ${c.discountType === "flat" ? "selected" : ""}>Flat</option>
      </select></div>
      <div class="row"><label>Discount value</label><input name="discountValue" value="${c.discountValue ?? ""}"></div>
      <div class="row"><label>Discount code</label><input name="discountCode" value="${esc(c.discountCode || "")}"></div>
      <div class="row"><label>Linked promotion</label><select name="promotionId">
        <option value="">—</option>
        ${promoOpts.map((p) => `<option value="${p.id}" ${c.promotionId === p.id ? "selected" : ""}>${esc(p.code)} — ${esc(p.name)}</option>`).join("")}
      </select></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="autoApplyDiscount" ${c.autoApplyDiscount ? "checked" : ""}> Auto-apply discount (no code entry)</label>
    <h3 style="margin-top:16px">Scheduling</h3>
    <div class="row2">
      <div class="row"><label>Starts</label><input type="datetime-local" name="startsAt" value="${toLocal(c.startsAt, c.timezone)}"></div>
      <div class="row"><label>Ends</label><input type="datetime-local" name="endsAt" value="${toLocal(c.endsAt, c.timezone)}"></div>
      <div class="row"><label>Timezone</label><input name="timezone" value="${esc(c.timezone || "Asia/Karachi")}"></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="showCountdown" ${c.showCountdown ? "checked" : ""}> Show countdown timer</label>
    <h3 style="margin-top:16px">Banner</h3>
    <div class="row2">
      <div class="row"><label>Placement</label><select name="bannerPlacement">${PLACEMENTS.map(
        (p) => `<option value="${p}" ${c.bannerPlacement === p ? "selected" : ""}>${p.replace(/_/g, " ")}</option>`
      ).join("")}</select></div>
      <div class="row"><label>Scope</label><select name="bannerScope">${SCOPES.map(
        (p) => `<option value="${p}" ${c.bannerScope === p ? "selected" : ""}>${p.replace(/_/g, " ")}</option>`
      ).join("")}</select></div>
      <div class="row"><label>Audience</label><select name="audience">${AUDIENCES.map(
        (p) => `<option value="${p}" ${c.audience === p ? "selected" : ""}>${p.replace(/_/g, " ")}</option>`
      ).join("")}</select></div>
    </div>
    <div class="row2">
      <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="dismissible" ${c.dismissible !== false ? "checked" : ""}> Dismissible</label>
      <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="persistent" ${c.persistent ? "checked" : ""}> Persistent</label>
      <label style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" name="animated" ${c.animated !== false ? "checked" : ""}> Animated</label>
    </div>
    <h3 style="margin-top:16px">Targeting</h3>
    <div class="row2">
      <div class="row"><label>Products</label>${multiSelect("productIds", productOpts, productIds)}</div>
      <div class="row"><label>Plans</label>${multiSelect("planIds", planOpts, planIds)}</div>
      <div class="row"><label>Categories</label>${multiSelect("categoryIds", categoryOpts, categoryIds)}</div>
    </div>
    <div class="row2">
      <div class="row"><label>UTM source</label><input name="utmSource" value="${esc(c.utmSource || "")}"></div>
      <div class="row"><label>UTM medium</label><input name="utmMedium" value="${esc(c.utmMedium || "")}"></div>
      <div class="row"><label>UTM campaign</label><input name="utmCampaign" value="${esc(c.utmCampaign || "")}"></div>
    </div>
    <div class="row"><label>Internal notes</label><textarea name="internalNotes">${esc(c.internalNotes || "")}</textarea></div>`;
}

module.exports = function registerMarketingCampaignRoutes({ app, csrf, token, portalShell }) {
  async function loadOptions() {
    const [items, categories, promoList] = await Promise.all([
      catalog.listItems({ admin: true }),
      catalog.listCategories({ includeDisabled: true }),
      promotions.list(),
    ]);
    return {
      productOpts: items.map((i) => ({ id: i.id, label: i.name })),
      planOpts: items.flatMap((i) => (i.plans || []).map((p) => ({ id: p.id, label: `${i.name} · ${p.name}` }))),
      categoryOpts: categories.map((c) => ({ id: c.id, label: c.name })),
      promoOpts: (promoList || []).map((p) => ({ id: p.id, code: p.code, name: p.name })),
    };
  }

  app.get(`${R}/catalog/marketing`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    const status = String(req.query.status || "");
    const q = String(req.query.q || "").trim();
    const [rows, stats] = await Promise.all([
      campaigns.list({ status: status || undefined, q: q || undefined }),
      campaigns.analytics(),
    ]);
    const canManage = authz.can(req, "catalog.manage_campaigns");
    const inner = `${flash(req)}
    <div class="grid cards" style="margin-bottom:12px">
      <div class="card"><div class="k">Published</div><div class="v">${stats.published}</div></div>
      <div class="card"><div class="k">Scheduled</div><div class="v">${stats.scheduled}</div></div>
      <div class="card"><div class="k">Views</div><div class="v">${stats.views}</div></div>
      <div class="card"><div class="k">Banner clicks</div><div class="v">${stats.bannerClicks}</div></div>
      <div class="card"><div class="k">CTA clicks</div><div class="v">${stats.ctaClicks}</div></div>
      <div class="card"><div class="k">Click rate</div><div class="v">${stats.conversionRate}%</div></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><strong>Marketing Campaigns</strong><div class="muted">Banners, offers, and timed promotions on the public site</div></div>
        ${canManage ? `<a class="btn primary sm" href="${R}/catalog/marketing/new">Create campaign</a>` : ""}
      </div>
      <form class="toolbar" method="get">
        <input name="q" value="${esc(q)}" placeholder="Search">
        <select name="status"><option value="">All</option>${STATUSES.map(
          (s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s}</option>`
        ).join("")}</select>
        <button class="btn sm" type="submit">Filter</button>
      </form>
      <table class="stack" style="margin-top:12px"><thead><tr><th>Campaign</th><th>Type</th><th>Window</th><th>Status</th><th>Views</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (c) => `<tr>
          <td data-label="Campaign"><strong>${esc(c.name)}</strong><div class="muted">${esc(c.slug)}</div></td>
          <td data-label="Type">${esc((c.campaignType || "").replace(/_/g, " "))}</td>
          <td data-label="Window">${c.startsAt ? esc(String(c.startsAt).slice(0, 16).replace("T", " ")) : "—"} → ${c.endsAt ? esc(String(c.endsAt).slice(0, 16).replace("T", " ")) : "—"}</td>
          <td data-label="Status">${statusBadge(c.status)}</td>
          <td data-label="Views">${c.viewCount || 0}</td>
          <td data-label=""><a class="btn sm" href="${R}/catalog/marketing/${c.id}">Open</a></td>
        </tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No campaigns yet.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Marketing Campaigns", inner, req));
  });

  // Redirect legacy light campaigns path
  app.get(`${R}/catalog/campaigns`, ...guard, (req, res) => res.redirect(`${R}/catalog/marketing`));

  app.get(`${R}/catalog/marketing/new`, ...guard, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    const opts = await loadOptions();
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const blank = { status: "draft", campaignType: "custom", dismissible: true, animated: true, timezone: "Asia/Karachi", bannerPlacement: "top_bar", bannerScope: "entire_website", audience: "all" };
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.3fr .7fr">
      <div class="panel"><strong>Create campaign</strong>
        <form method="post" action="${R}/catalog/marketing" style="margin-top:12px">
          ${formFields(blank, { ...opts, csrfField })}
          <button class="btn primary" type="submit">Create</button>
          <a class="btn" href="${R}/catalog/marketing">Cancel</a>
        </form>
      </div>
      ${previewHtml(blank)}
    </div>`;
    res.send(portalShell("Marketing Campaigns", inner, req));
  });

  app.post(`${R}/catalog/marketing`, ...guard, csrf, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    try {
      const data = bodyToCampaign(req.body);
      if (!data.name) return redirectWith(res, `${R}/catalog/marketing/new`, { error: "Name required" });
      if (data.status === "scheduled" && !data.startsAt) data.status = "draft";
      const row = await campaigns.create(data, {
        productIds: selectedIds(req.body, "productIds"),
        planIds: selectedIds(req.body, "planIds"),
        categoryIds: selectedIds(req.body, "categoryIds"),
      });
      audit(req, "CAMPAIGN_CREATED", { targetType: "marketing_campaign", targetId: row.id, next: { slug: row.slug } });
      redirectWith(res, `${R}/catalog/marketing/${row.id}`, { notice: "Campaign created." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/marketing/new`, { error: err.message || "Could not create" });
    }
  });

  app.get(`${R}/catalog/marketing/:id`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    if (req.params.id === "new") return;
    const c = await campaigns.get(req.params.id);
    if (!c) return redirectWith(res, `${R}/catalog/marketing`, { error: "Not found" });
    const opts = await loadOptions();
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const canManage = authz.can(req, "catalog.manage_campaigns");
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1.3fr .7fr">
      <div class="panel">
        <div class="panel-head">
          <div><strong>${esc(c.name)}</strong> ${statusBadge(c.status)}<div class="muted">${esc(c.slug)} · views ${c.viewCount || 0} · banner ${c.bannerClickCount || 0} · CTA ${c.ctaClickCount || 0}</div></div>
          <div class="actions">
            <a class="btn sm" href="${R}/catalog/marketing">All</a>
            ${
              canManage
                ? `
              <form method="post" action="${R}/catalog/marketing/${c.id}/duplicate" style="display:inline">${csrfField}<button class="btn sm" type="submit">Duplicate</button></form>
              <form method="post" action="${R}/catalog/marketing/${c.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="published"><button class="btn primary sm" type="submit">Publish</button></form>
              <form method="post" action="${R}/catalog/marketing/${c.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="paused"><button class="btn sm" type="submit">Pause</button></form>
              <form method="post" action="${R}/catalog/marketing/${c.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="archived"><button class="btn sm" type="submit">Archive</button></form>
              <form method="post" action="${R}/catalog/marketing/${c.id}/delete" style="display:inline" onsubmit="return confirm('Delete this campaign?');">${csrfField}<button class="btn danger sm" type="submit">Delete</button></form>`
                : ""
            }
          </div>
        </div>
        ${
          canManage
            ? `<form method="post" action="${R}/catalog/marketing/${c.id}">
          ${formFields(c, { ...opts, csrfField })}
          <button class="btn primary" type="submit">Save</button>
        </form>`
            : `<p>${esc(c.headline || "")}</p><p class="muted">${esc(c.description || "")}</p>`
        }
      </div>
      ${previewHtml(c)}
    </div>`;
    res.send(portalShell("Marketing Campaigns", inner, req));
  });

  app.post(`${R}/catalog/marketing/:id`, ...guard, csrf, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    try {
      const data = bodyToCampaign(req.body);
      await campaigns.update(req.params.id, data, {
        productIds: selectedIds(req.body, "productIds"),
        planIds: selectedIds(req.body, "planIds"),
        categoryIds: selectedIds(req.body, "categoryIds"),
      });
      audit(req, "CAMPAIGN_EDITED", { targetType: "marketing_campaign", targetId: req.params.id });
      redirectWith(res, `${R}/catalog/marketing/${req.params.id}`, { notice: "Campaign saved." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/marketing/${req.params.id}`, { error: err.message || "Save failed" });
    }
  });

  app.post(`${R}/catalog/marketing/:id/status`, ...guard, csrf, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    const status = String(req.body.status || "");
    await campaigns.setStatus(req.params.id, status);
    const action =
      status === "published"
        ? "CAMPAIGN_PUBLISHED"
        : status === "paused"
          ? "CAMPAIGN_PAUSED"
          : status === "archived"
            ? "CAMPAIGN_ARCHIVED"
            : "CAMPAIGN_EDITED";
    audit(req, action, { targetType: "marketing_campaign", targetId: req.params.id, next: { status } });
    redirectWith(res, `${R}/catalog/marketing/${req.params.id}`, { notice: `Marked ${status}.` });
  });

  app.post(`${R}/catalog/marketing/:id/duplicate`, ...guard, csrf, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    const copy = await campaigns.duplicate(req.params.id);
    if (!copy) return redirectWith(res, `${R}/catalog/marketing`, { error: "Not found" });
    audit(req, "CAMPAIGN_CREATED", { targetType: "marketing_campaign", targetId: copy.id, detail: "duplicated" });
    redirectWith(res, `${R}/catalog/marketing/${copy.id}`, { notice: "Campaign duplicated." });
  });

  app.post(`${R}/catalog/marketing/:id/delete`, ...guard, csrf, authz.requirePermission("catalog.manage_campaigns"), async (req, res) => {
    await campaigns.softDelete(req.params.id);
    audit(req, "CAMPAIGN_DELETED", { targetType: "marketing_campaign", targetId: req.params.id });
    redirectWith(res, `${R}/catalog/marketing`, { notice: "Campaign deleted." });
  });
};
