/**
 * Catalog Sandbox Manager — Super Admin staging environment.
 */
const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const authz = require("./authz");
const { SandboxRepository: sandbox } = require("./db/repositories/sandbox");
const { CatalogRepository: catalog } = require("./db/repositories/catalog");
const { setSandboxCookie } = require("./sandboxPreview");

const { esc } = views;
const R = config.portalRoute;
const guard = [authz.requireAuth, authz.requireActiveUser, authz.requireSuperAdmin];

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

function statusBadge(status) {
  const map = {
    published: "ok",
    ready_for_review: "",
    scheduled: "",
    draft: "",
    archived: "warn",
  };
  return `<span class="badge ${map[status] || ""}">${esc((status || "").replace(/_/g, " "))}</span>`;
}

module.exports = function registerSandboxRoutes({ app, csrf, token, portalShell }) {
  app.get(`${R}/catalog/sandbox`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    const status = String(req.query.status || "");
    const q = String(req.query.q || "").trim();
    const rows = await sandbox.list({ status: status || undefined, q: q || undefined });
    const canManage = authz.can(req, "catalog.manage_sandbox");
    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>Sandbox Environment</strong><div class="muted">Stage catalog changes safely — nothing goes live until you publish</div></div>
        ${canManage ? `<a class="btn primary sm" href="${R}/catalog/sandbox/new">Create sandbox</a>` : ""}
      </div>
      <form class="toolbar" method="get">
        <input name="q" value="${esc(q)}" placeholder="Search">
        <select name="status"><option value="">All</option>${sandbox.STATUSES.map(
          (s) => `<option value="${s}" ${status === s ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`
        ).join("")}</select>
        <button class="btn sm" type="submit">Filter</button>
      </form>
      <table class="stack" style="margin-top:12px"><thead><tr><th>Sandbox</th><th>Status</th><th>Changes</th><th>Updated</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (s) => `<tr>
          <td data-label="Sandbox"><strong>${esc(s.name)}</strong><div class="muted">${esc(s.description || "")}</div></td>
          <td data-label="Status">${statusBadge(s.status)}</td>
          <td data-label="Changes">${s._count?.changes || 0}</td>
          <td data-label="Updated">${esc(String(s.updatedAt).slice(0, 16).replace("T", " "))}</td>
          <td data-label=""><a class="btn sm" href="${R}/catalog/sandbox/${s.id}">Open</a></td>
        </tr>`
        )
        .join("") || `<tr><td colspan="5" class="muted">No sandboxes yet.</td></tr>`}</tbody></table>
    </div>`;
    res.send(portalShell("Sandbox", inner, req));
  });

  app.get(`${R}/catalog/sandbox/new`, ...guard, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const inner = `${flash(req)}
    <div class="panel"><strong>Create sandbox session</strong>
      <form method="post" action="${R}/catalog/sandbox" style="margin-top:12px">
        ${csrfField}
        <div class="row"><label>Name</label><input name="name" required placeholder="e.g. EduTrack Q3 pricing"></div>
        <div class="row"><label>Description</label><textarea name="description" placeholder="What will you test?"></textarea></div>
        <button class="btn primary" type="submit">Create</button>
        <a class="btn" href="${R}/catalog/sandbox">Cancel</a>
      </form>
    </div>`;
    res.send(portalShell("Sandbox", inner, req));
  });

  app.post(`${R}/catalog/sandbox`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      const row = await sandbox.create({
        name: req.body.name,
        description: req.body.description,
        createdById: req.user?.id || null,
      });
      audit(req, "SANDBOX_CREATED", { targetType: "sandbox_session", targetId: row.id });
      redirectWith(res, `${R}/catalog/sandbox/${row.id}`, { notice: "Sandbox created." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/sandbox/new`, { error: err.message || "Could not create" });
    }
  });

  app.get(`${R}/catalog/sandbox/:id`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    if (req.params.id === "new") return;
    const s = await sandbox.get(req.params.id);
    if (!s) return redirectWith(res, `${R}/catalog/sandbox`, { error: "Not found" });
    const items = await catalog.listItems({ admin: true });
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const canManage = authz.can(req, "catalog.manage_sandbox");
    const activeToken = (s.tokens || []).find((t) => !t.revokedAt && new Date(t.expiresAt) > new Date());
    const lastValidation = (s.validations || [])[0];
    const diffs = (s.changes || []).map((c) => sandbox.diffChange(c));

    const previewPanel = activeToken
      ? `<div class="panel">
          <strong>Private preview</strong>
          <p class="muted" style="margin:8px 0">Secure URL (auth required to open). Non-indexable · expires ${esc(String(activeToken.expiresAt).slice(0, 16).replace("T", " "))}</p>
          <code>/preview/${esc(activeToken.token)}</code>
          <div class="actions" style="margin-top:10px">
            <a class="btn primary sm" href="/preview/${esc(activeToken.token)}" target="_blank" rel="noopener nofollow">Open live preview</a>
            <a class="btn sm" href="/preview/${esc(activeToken.token)}?viewport=mobile" target="_blank" rel="noopener nofollow">Mobile</a>
            <a class="btn sm" href="/preview/${esc(activeToken.token)}?viewport=tablet" target="_blank" rel="noopener nofollow">Tablet</a>
            <a class="btn sm" href="/preview/${esc(activeToken.token)}?viewport=desktop" target="_blank" rel="noopener nofollow">Desktop</a>
          </div>
        </div>`
      : `<div class="panel"><strong>Private preview</strong><p class="muted">Generate a preview token to open the real website with sandbox data.</p></div>`;

    const inner = `${flash(req)}
    <div class="panel">
      <div class="panel-head">
        <div><strong>${esc(s.name)}</strong> ${statusBadge(s.status)}
          <div class="muted">${esc(s.description || "")} · created ${esc(String(s.createdAt).slice(0, 10))} by ${esc(s.createdBy?.fullName || s.createdBy?.email || "—")}</div>
        </div>
        <div class="actions">
          <a class="btn sm" href="${R}/catalog/sandbox">All</a>
          ${
            canManage
              ? `
            <form method="post" action="${R}/catalog/sandbox/${s.id}/token" style="display:inline">${csrfField}
              <input type="hidden" name="ttlHours" value="24">
              <button class="btn sm" type="submit">${activeToken ? "Regenerate token" : "Generate preview token"}</button>
            </form>
            <form method="post" action="${R}/catalog/sandbox/${s.id}/validate" style="display:inline">${csrfField}<button class="btn sm" type="submit">Validate</button></form>
            <form method="post" action="${R}/catalog/sandbox/${s.id}/status" style="display:inline">${csrfField}<input type="hidden" name="status" value="ready_for_review"><button class="btn sm" type="submit">Ready for review</button></form>
            <form method="post" action="${R}/catalog/sandbox/${s.id}/publish" style="display:inline" onsubmit="return confirm('Publish sandbox to live website?');">${csrfField}<button class="btn primary sm" type="submit">Publish now</button></form>
            <form method="post" action="${R}/catalog/sandbox/${s.id}/delete" style="display:inline" onsubmit="return confirm('Archive/delete this sandbox?');">${csrfField}<button class="btn danger sm" type="submit">Delete</button></form>`
              : ""
          }
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1.2fr .8fr;gap:12px;margin-top:12px">
      <div>
        ${
          canManage
            ? `<div class="panel"><strong>Add product to sandbox</strong>
          <form method="post" action="${R}/catalog/sandbox/${s.id}/add-item" style="margin-top:10px" class="toolbar">
            ${csrfField}
            <select name="itemId" required><option value="">Select live product…</option>${items
              .map((i) => `<option value="${i.id}">${esc(i.name)} (${esc(i.workflowStatus)})</option>`)
              .join("")}</select>
            <button class="btn sm" type="submit">Add to sandbox</button>
          </form>
          <p class="muted" style="margin-top:8px;font-size:12px">Copies the live product into an isolated overlay. Public site stays unchanged until publish.</p>
        </div>`
            : ""
        }

        <div class="panel" style="margin-top:12px"><strong>Sandbox changes</strong>
          <table class="stack" style="margin-top:10px"><thead><tr><th>Change</th><th>Type</th><th>Entity</th><th></th></tr></thead>
          <tbody>${(s.changes || [])
            .map(
              (c) => `<tr>
              <td data-label="Change"><strong>${esc(c.label || c.entitySlug || c.id)}</strong><div class="muted">${esc(c.entitySlug || "")}</div></td>
              <td data-label="Type">${esc(c.changeType)}</td>
              <td data-label="Entity">${esc(c.entityType.replace(/_/g, " "))}</td>
              <td data-label="">
                <a class="btn sm" href="${R}/catalog/sandbox/${s.id}/changes/${c.id}">Edit / Diff</a>
              </td>
            </tr>`
            )
            .join("") || `<tr><td colspan="4" class="muted">No changes yet — add a product above.</td></tr>`}</tbody></table>
        </div>

        <div class="panel" style="margin-top:12px"><strong>Difference overview</strong>
          ${(diffs || [])
            .map((d) => {
              if (!d.fields.length) return `<p class="muted">${esc(d.label)} — no field differences</p>`;
              return `<div style="margin-top:8px"><strong>${esc(d.label)}</strong>
                <ul style="margin:6px 0 0;padding-left:18px">${d.fields
                  .slice(0, 20)
                  .map(
                    (f) =>
                      `<li><span class="badge ${f.kind === "added" ? "ok" : f.kind === "removed" ? "warn" : ""}">${esc(f.kind)}</span> ${esc(f.path)}</li>`
                  )
                  .join("")}${d.fields.length > 20 ? `<li class="muted">+${d.fields.length - 20} more</li>` : ""}</ul></div>`;
            })
            .join("") || `<p class="muted">No diffs yet.</p>`}
        </div>
      </div>

      <div>
        ${previewPanel}

        <div class="panel" style="margin-top:12px"><strong>Schedule publish</strong>
          ${
            canManage
              ? `<form method="post" action="${R}/catalog/sandbox/${s.id}/schedule" style="margin-top:10px">
            ${csrfField}
            <div class="row"><label>Publish at</label><input type="datetime-local" name="scheduledFor" required></div>
            <div class="row"><label>Timezone</label><input name="timezone" value="Asia/Karachi"></div>
            <button class="btn sm" type="submit">Schedule</button>
          </form>`
              : ""
          }
          <ul style="margin-top:10px;padding-left:18px">${(s.publishJobs || [])
            .map(
              (j) =>
                `<li>${esc(j.status)} · ${esc(String(j.scheduledFor).slice(0, 16).replace("T", " "))} ${j.errorMessage ? `· <span class="error">${esc(j.errorMessage)}</span>` : ""}</li>`
            )
            .join("") || `<li class="muted">No publish jobs</li>`}</ul>
        </div>

        <div class="panel" style="margin-top:12px"><strong>Validation</strong>
          ${
            lastValidation
              ? `<p>${lastValidation.passed ? '<span class="badge ok">Passed</span>' : '<span class="badge warn">Failed</span>'} · ${lastValidation.errorCount} errors · ${lastValidation.warningCount} warnings · ${esc(String(lastValidation.createdAt).slice(0, 16).replace("T", " "))}</p>
            <ul style="padding-left:18px">${((lastValidation.reportJson && lastValidation.reportJson.issues) || [])
              .slice(0, 15)
              .map((i) => `<li><span class="badge ${i.level === "error" ? "warn" : ""}">${esc(i.level)}</span> ${esc(i.path)} — ${esc(i.message)}</li>`)
              .join("")}</ul>`
              : `<p class="muted">Run validation before publishing.</p>`
          }
        </div>

        ${
          s.status === "published" && (s.changes || []).some((c) => c.entityId)
            ? `<div class="panel" style="margin-top:12px"><strong>Rollback</strong>
            <p class="muted">Restore previous published version via Catalog Versioning.</p>
            ${(s.changes || [])
              .filter((c) => c.entityId && c.entityType === "catalog_item")
              .map(
                (c) => `<form method="post" action="${R}/catalog/sandbox/${s.id}/rollback" style="margin-top:8px">${csrfField}
                <input type="hidden" name="itemId" value="${esc(c.entityId)}">
                <button class="btn sm" type="submit" onclick="return confirm('Rollback ${esc(c.label)}?')">Rollback ${esc(c.label)}</button>
              </form>`
              )
              .join("")}
          </div>`
            : ""
        }
      </div>
    </div>`;
    res.send(portalShell("Sandbox", inner, req));
  });

  app.get(`${R}/catalog/sandbox/:id/changes/:changeId`, ...guard, authz.requirePermission("catalog.view"), async (req, res) => {
    const s = await sandbox.get(req.params.id);
    const change = await sandbox.getChange(req.params.changeId);
    if (!s || !change || change.sessionId !== s.id) {
      return redirectWith(res, `${R}/catalog/sandbox`, { error: "Not found" });
    }
    const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
    const canManage = authz.can(req, "catalog.manage_sandbox");
    const after = change.afterJson || {};
    const diff = sandbox.diffChange(change);
    const inner = `${flash(req)}
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
      <div class="panel">
        <div class="panel-head">
          <div><strong>Edit sandbox change</strong><div class="muted">${esc(change.label)} · ${esc(change.changeType)}</div></div>
          <a class="btn sm" href="${R}/catalog/sandbox/${s.id}">Back</a>
        </div>
        ${
          canManage
            ? `<form method="post" action="${R}/catalog/sandbox/${s.id}/changes/${change.id}">
          ${csrfField}
          <div class="row"><label>Name</label><input name="name" value="${esc(after.name || "")}" required></div>
          <div class="row"><label>Slug</label><input name="slug" value="${esc(after.slug || "")}"></div>
          <div class="row"><label>Short description</label><textarea name="shortDescription">${esc(after.shortDescription || "")}</textarea></div>
          <div class="row"><label>Full description</label><textarea name="fullDescription">${esc(after.fullDescription || "")}</textarea></div>
          <div class="row2">
            <div class="row"><label>CTA text</label><input name="ctaText" value="${esc(after.ctaText || "")}"></div>
            <div class="row"><label>CTA link</label><input name="ctaLink" value="${esc(after.ctaLink || "")}"></div>
          </div>
          <div class="row2">
            <div class="row"><label>Accent</label><input name="accentColor" value="${esc(after.accentColor || "#2563EB")}"></div>
            <div class="row"><label>SEO title</label><input name="seoTitle" value="${esc(after.seoTitle || "")}"></div>
          </div>
          <div class="row"><label>SEO description</label><textarea name="seoDescription">${esc(after.seoDescription || "")}</textarea></div>
          <div class="row"><label>Plans JSON</label><textarea name="plansJson" rows="12" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(after.plans || [], null, 2))}</textarea>
            <p class="muted" style="font-size:12px">Edit plan prices, badges, features for sandbox preview.</p>
          </div>
          <input type="hidden" name="categoryId" value="${esc(after.categoryId || "")}">
          <input type="hidden" name="productTypeId" value="${esc(after.productTypeId || "")}">
          <button class="btn primary" type="submit">Save sandbox change</button>
        </form>
        <form method="post" action="${R}/catalog/sandbox/${s.id}/changes/${change.id}/delete" style="margin-top:12px" onsubmit="return confirm('Remove this change from sandbox?');">
          ${csrfField}<button class="btn danger sm" type="submit">Remove from sandbox</button>
        </form>`
            : `<pre style="white-space:pre-wrap">${esc(JSON.stringify(after, null, 2))}</pre>`
        }
      </div>
      <div class="panel">
        <strong>Live vs Sandbox</strong>
        <table class="stack" style="margin-top:10px"><thead><tr><th>Field</th><th>Change</th><th>Live</th><th>Sandbox</th></tr></thead>
        <tbody>${diff.fields
          .map(
            (f) => `<tr>
            <td data-label="Field">${esc(f.path)}</td>
            <td data-label="Change"><span class="badge">${esc(f.kind)}</span></td>
            <td data-label="Live"><code style="font-size:11px">${esc(JSON.stringify(f.before))}</code></td>
            <td data-label="Sandbox"><code style="font-size:11px">${esc(JSON.stringify(f.after))}</code></td>
          </tr>`
          )
          .join("") || `<tr><td colspan="4" class="muted">Identical to live</td></tr>`}</tbody></table>
      </div>
    </div>`;
    res.send(portalShell("Sandbox change", inner, req));
  });

  app.post(`${R}/catalog/sandbox/:id/add-item`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      await sandbox.addCatalogItem(req.params.id, req.body.itemId);
      audit(req, "SANDBOX_EDITED", { targetType: "sandbox_session", targetId: req.params.id, detail: "add_item" });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: "Product added to sandbox." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { error: err.message || "Could not add" });
    }
  });

  app.post(`${R}/catalog/sandbox/:id/changes/:changeId`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      const change = await sandbox.getChange(req.params.changeId);
      if (!change || change.sessionId !== req.params.id) throw new Error("Not found");
      let plans = change.afterJson?.plans || [];
      if (req.body.plansJson) {
        try {
          plans = JSON.parse(req.body.plansJson);
        } catch (_e) {
          throw new Error("Plans JSON is invalid");
        }
      }
      const after = {
        ...(change.afterJson || {}),
        name: String(req.body.name || "").trim(),
        slug: String(req.body.slug || "").trim(),
        shortDescription: String(req.body.shortDescription || "").trim(),
        fullDescription: String(req.body.fullDescription || "").trim(),
        ctaText: String(req.body.ctaText || "").trim(),
        ctaLink: String(req.body.ctaLink || "").trim(),
        accentColor: String(req.body.accentColor || "").trim(),
        seoTitle: String(req.body.seoTitle || "").trim(),
        seoDescription: String(req.body.seoDescription || "").trim(),
        categoryId: req.body.categoryId || change.afterJson?.categoryId,
        productTypeId: req.body.productTypeId || change.afterJson?.productTypeId,
        plans,
      };
      await sandbox.updateChange(change.id, after, after.name);
      audit(req, "SANDBOX_EDITED", { targetType: "sandbox_change", targetId: change.id });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}/changes/${change.id}`, { notice: "Sandbox change saved." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}/changes/${req.params.changeId}`, {
        error: err.message || "Save failed",
      });
    }
  });

  app.post(
    `${R}/catalog/sandbox/:id/changes/:changeId/delete`,
    ...guard,
    csrf,
    authz.requirePermission("catalog.manage_sandbox"),
    async (req, res) => {
      await sandbox.deleteChange(req.params.changeId);
      audit(req, "SANDBOX_EDITED", { targetType: "sandbox_change", targetId: req.params.changeId, detail: "removed" });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: "Change removed." });
    }
  );

  app.post(`${R}/catalog/sandbox/:id/token`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    const row = await sandbox.createPreviewToken(req.params.id, {
      createdById: req.user?.id,
      ttlHours: Number(req.body.ttlHours) || 24,
    });
    audit(req, "SANDBOX_PREVIEW_TOKEN", { targetType: "sandbox_session", targetId: req.params.id });
    redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: `Preview token ready: /preview/${row.token}` });
  });

  app.post(`${R}/catalog/sandbox/:id/validate`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    const result = await sandbox.validate(req.params.id);
    audit(req, result.passed ? "SANDBOX_VALIDATION_PASSED" : "SANDBOX_VALIDATION_FAILED", {
      targetType: "sandbox_session",
      targetId: req.params.id,
      next: { errors: result.errorCount, warnings: result.warningCount },
    });
    redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, {
      notice: result.passed
        ? `Validation passed (${result.warningCount} warnings).`
        : `Validation failed: ${result.errorCount} error(s).`,
    });
  });

  app.post(`${R}/catalog/sandbox/:id/status`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    await sandbox.update(req.params.id, { status: String(req.body.status || "draft") });
    audit(req, "SANDBOX_EDITED", { targetType: "sandbox_session", targetId: req.params.id, next: { status: req.body.status } });
    redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: "Status updated." });
  });

  app.post(`${R}/catalog/sandbox/:id/publish`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      const result = await sandbox.publishNow(req.params.id, { req, actorId: req.user?.id });
      audit(req, "SANDBOX_PUBLISHED", {
        targetType: "sandbox_session",
        targetId: req.params.id,
        next: { publishedIds: result.publishedIds },
      });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: "Sandbox published to live catalog." });
    } catch (err) {
      audit(req, "SANDBOX_VALIDATION_FAILED", { targetType: "sandbox_session", targetId: req.params.id });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { error: err.message || "Publish failed" });
    }
  });

  app.post(`${R}/catalog/sandbox/:id/schedule`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      await sandbox.schedulePublish(req.params.id, {
        scheduledFor: req.body.scheduledFor,
        timezone: req.body.timezone,
        createdById: req.user?.id,
      });
      audit(req, "SANDBOX_SCHEDULED", { targetType: "sandbox_session", targetId: req.params.id });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { notice: "Publish scheduled." });
    } catch (err) {
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { error: err.message || "Schedule failed" });
    }
  });

  app.post(`${R}/catalog/sandbox/:id/rollback`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    try {
      const prev = await sandbox.rollbackItem(req.body.itemId, { req });
      audit(req, "SANDBOX_ROLLED_BACK", {
        targetType: "catalog_item",
        targetId: req.body.itemId,
        next: { version: prev.versionNumber },
      });
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, {
        notice: `Rolled back to version ${prev.versionNumber}.`,
      });
    } catch (err) {
      redirectWith(res, `${R}/catalog/sandbox/${req.params.id}`, { error: err.message || "Rollback failed" });
    }
  });

  app.post(`${R}/catalog/sandbox/:id/delete`, ...guard, csrf, authz.requirePermission("catalog.manage_sandbox"), async (req, res) => {
    await sandbox.softDelete(req.params.id);
    audit(req, "SANDBOX_DELETED", { targetType: "sandbox_session", targetId: req.params.id });
    redirectWith(res, `${R}/catalog/sandbox`, { notice: "Sandbox archived." });
  });

  // Secure preview entry — requires Super Admin session AND valid token
  app.get("/preview/:token", ...guard, async (req, res) => {
    const row = await sandbox.resolvePreviewToken(req.params.token);
    if (!row) {
      return res.status(404).type("html").send(`<!doctype html><title>Preview expired</title>
        <meta name="robots" content="noindex,nofollow">
        <body style="font-family:system-ui;padding:40px"><h1>Preview unavailable</h1>
        <p>This sandbox preview link is invalid, revoked, or expired.</p>
        <a href="${R}/catalog/sandbox">Back to Sandbox</a></body>`);
    }
    setSandboxCookie(res, row.token, row.expiresAt);
    audit(req, "SANDBOX_PREVIEW_OPENED", { targetType: "sandbox_session", targetId: row.sessionId });
    const viewport = String(req.query.viewport || "desktop");
    const widths = { mobile: 390, tablet: 768, laptop: 1280, desktop: 1440 };
    const w = widths[viewport] || null;
    const target = String(req.query.to || "/products/index.html");
    if (w) {
      return res.type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">
<title>Sandbox preview · ${esc(viewport)}</title>
<style>
  body{margin:0;background:#0f172a;color:#fff;font-family:system-ui}
  .bar{display:flex;gap:8px;align-items:center;padding:10px 14px;background:#111827}
  .bar a{color:#93c5fd;text-decoration:none;font-size:13px}
  .frame-wrap{display:flex;justify-content:center;padding:16px}
  iframe{width:${w}px;max-width:100%;height:calc(100vh - 70px);border:0;border-radius:12px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .badge{background:#f59e0b;color:#111;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
</style></head>
<body>
  <div class="bar">
    <span class="badge">SANDBOX</span>
    <strong>${esc(row.session.name)}</strong>
    <a href="/preview/${esc(row.token)}?viewport=mobile">Mobile</a>
    <a href="/preview/${esc(row.token)}?viewport=tablet">Tablet</a>
    <a href="/preview/${esc(row.token)}?viewport=laptop">Laptop</a>
    <a href="/preview/${esc(row.token)}?viewport=desktop">Desktop</a>
    <a href="/preview/${esc(row.token)}">Full page</a>
    <a href="${R}/catalog/sandbox/${esc(row.sessionId)}">Exit</a>
  </div>
  <div class="frame-wrap"><iframe src="${esc(target)}" title="Sandbox preview"></iframe></div>
</body></html>`);
    }
    res.redirect(target);
  });
};
