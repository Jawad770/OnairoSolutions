/**
 * Catalog Sandbox — isolated staging overlays until explicit publish.
 * Live public APIs never see sandbox data unless a valid preview token is present.
 */
const crypto = require("crypto");
const { prisma } = require("../prisma");
const { CatalogRepository: catalog } = require("./catalog");
const versioning = require("../../catalogVersioning");

const notDeleted = { deletedAt: null };
const STATUSES = ["draft", "ready_for_review", "scheduled", "published", "archived"];
const ENTITY_TYPES = ["catalog_item", "catalog_plan", "marketing_campaign", "promotion"];

function serializeSession(row) {
  if (!row) return null;
  return {
    ...row,
    changeCount: row.changes?.length ?? row._count?.changes ?? undefined,
  };
}

function deepClone(v) {
  return v == null ? null : JSON.parse(JSON.stringify(v));
}

function flattenItemSnapshot(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription,
    categoryId: item.categoryId,
    productTypeId: item.productTypeId,
    displayOrder: item.displayOrder,
    featured: item.featured,
    accentColor: item.accentColor,
    ctaText: item.ctaText,
    ctaLink: item.ctaLink,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    comingSoon: item.comingSoon,
    countdownEnabled: item.countdownEnabled,
    notifyMeEnabled: item.notifyMeEnabled,
    workflowStatus: item.workflowStatus,
    visibleWebsite: item.visibleWebsite,
    visibleAi: item.visibleAi,
    plans: (item.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      monthlyPrice: p.monthlyPrice != null ? Number(p.monthlyPrice) : null,
      yearlyPrice: p.yearlyPrice != null ? Number(p.yearlyPrice) : null,
      oneTimePrice: p.oneTimePrice != null ? Number(p.oneTimePrice) : null,
      currency: p.currency,
      badge: p.badge,
      popular: p.popular,
      recommended: p.recommended,
      color: p.color,
      ctaText: p.ctaText,
      ctaLink: p.ctaLink,
      workflowStatus: p.workflowStatus,
      visibleWebsite: p.visibleWebsite,
      features: (p.features || []).map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        included: f.included,
        valueText: f.valueText,
        icon: f.icon,
        displayOrder: f.displayOrder,
        enabled: f.enabled,
      })),
    })),
  };
}

function diffFields(before, after, paths = [], prefix = "") {
  const b = before && typeof before === "object" ? before : {};
  const a = after && typeof after === "object" ? after : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const key of keys) {
    if (["id", "createdAt", "updatedAt", "deletedAt", "currentRevisionId"].includes(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const bv = b[key];
    const av = a[key];
    if (Array.isArray(bv) || Array.isArray(av)) {
      const bs = JSON.stringify(bv ?? []);
      const as = JSON.stringify(av ?? []);
      if (bs !== as) {
        paths.push({
          path,
          kind: bv == null ? "added" : av == null ? "removed" : "modified",
          before: bv,
          after: av,
        });
      }
      continue;
    }
    if (bv && typeof bv === "object" && av && typeof av === "object") {
      diffFields(bv, av, paths, path);
      continue;
    }
    if (JSON.stringify(bv ?? null) !== JSON.stringify(av ?? null)) {
      paths.push({
        path,
        kind: bv == null || bv === "" ? "added" : av == null || av === "" ? "removed" : "modified",
        before: bv,
        after: av,
      });
    }
  }
  return paths;
}

const SandboxRepository = {
  STATUSES,
  ENTITY_TYPES,

  list({ status, q } = {}) {
    const where = { ...notDeleted };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    return prisma.sandboxSession
      .findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          _count: { select: { changes: true, tokens: true, publishJobs: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
      .then((rows) => rows.map(serializeSession));
  },

  get(id) {
    return prisma.sandboxSession
      .findFirst({
        where: { id, ...notDeleted },
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          changes: { orderBy: { updatedAt: "desc" } },
          tokens: { orderBy: { createdAt: "desc" }, take: 10 },
          publishJobs: { orderBy: { createdAt: "desc" }, take: 10 },
          validations: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      })
      .then(serializeSession);
  },

  create({ name, description, createdById }) {
    return prisma.sandboxSession.create({
      data: {
        name: String(name || "").trim() || "Untitled sandbox",
        description: description ? String(description).trim() : null,
        status: "draft",
        createdById: createdById || null,
      },
      include: { createdBy: { select: { id: true, email: true, fullName: true } }, changes: true },
    });
  },

  update(id, data) {
    const payload = {};
    if (data.name != null) payload.name = String(data.name).trim();
    if (data.description !== undefined) payload.description = data.description ? String(data.description).trim() : null;
    if (data.status && STATUSES.includes(data.status)) payload.status = data.status;
    if (data.status === "published") payload.publishedAt = new Date();
    if (data.status === "archived") payload.archivedAt = new Date();
    return prisma.sandboxSession.update({ where: { id }, data: payload });
  },

  softDelete(id) {
    return prisma.sandboxSession.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived", archivedAt: new Date() },
    });
  },

  async addCatalogItem(sessionId, itemId) {
    const item = await catalog.getItem(itemId, { admin: true });
    if (!item) throw new Error("Product not found");
    const existing = await prisma.sandboxChange.findFirst({
      where: { sessionId, entityType: "catalog_item", entityId: item.id },
    });
    if (existing) return existing;
    const snap = flattenItemSnapshot(item);
    return prisma.sandboxChange.create({
      data: {
        sessionId,
        entityType: "catalog_item",
        entityId: item.id,
        entitySlug: item.slug,
        changeType: "update",
        label: item.name,
        beforeJson: snap,
        afterJson: deepClone(snap),
      },
    });
  },

  async addNewCatalogItemDraft(sessionId, draft) {
    const slug = String(draft.slug || draft.name || "sandbox-product")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    const after = {
      id: null,
      name: draft.name || "New sandbox product",
      slug,
      shortDescription: draft.shortDescription || "",
      fullDescription: draft.fullDescription || "",
      categoryId: draft.categoryId,
      productTypeId: draft.productTypeId,
      displayOrder: 0,
      featured: false,
      accentColor: draft.accentColor || "#2563EB",
      ctaText: draft.ctaText || "Learn more",
      ctaLink: draft.ctaLink || "",
      seoTitle: draft.seoTitle || draft.name || "",
      seoDescription: draft.seoDescription || "",
      comingSoon: false,
      countdownEnabled: false,
      notifyMeEnabled: false,
      workflowStatus: "draft",
      visibleWebsite: true,
      visibleAi: true,
      plans: draft.plans || [],
    };
    return prisma.sandboxChange.create({
      data: {
        sessionId,
        entityType: "catalog_item",
        entityId: null,
        entitySlug: slug,
        changeType: "create",
        label: after.name,
        beforeJson: null,
        afterJson: after,
      },
    });
  },

  getChange(changeId) {
    return prisma.sandboxChange.findFirst({ where: { id: changeId } });
  },

  async updateChange(changeId, afterJson, label) {
    const data = { afterJson };
    if (label != null) data.label = label;
    if (afterJson?.slug) data.entitySlug = String(afterJson.slug);
    if (afterJson?.name) data.label = String(afterJson.name);
    return prisma.sandboxChange.update({ where: { id: changeId }, data });
  },

  deleteChange(changeId) {
    return prisma.sandboxChange.delete({ where: { id: changeId } });
  },

  diffChange(change) {
    return {
      changeId: change.id,
      entityType: change.entityType,
      changeType: change.changeType,
      label: change.label,
      fields: diffFields(change.beforeJson, change.afterJson),
    };
  },

  async validate(sessionId) {
    const session = await this.get(sessionId);
    if (!session) throw new Error("Sandbox not found");
    const issues = [];
    const slugs = new Set();

    for (const change of session.changes || []) {
      const after = change.afterJson || {};
      if (change.entityType === "catalog_item") {
        if (!after.name) issues.push({ level: "error", path: `${change.label}.name`, message: "Product name is required" });
        if (!after.slug) issues.push({ level: "error", path: `${change.label}.slug`, message: "Product slug is required" });
        if (after.slug) {
          if (slugs.has(after.slug)) {
            issues.push({ level: "error", path: `${change.label}.slug`, message: `Duplicate slug "${after.slug}" in sandbox` });
          }
          slugs.add(after.slug);
          const live = await catalog.getItemBySlug(after.slug, { admin: true });
          if (live && live.id !== change.entityId) {
            issues.push({ level: "error", path: `${change.label}.slug`, message: `Slug "${after.slug}" already used live` });
          }
        }
        if (!after.seoTitle) issues.push({ level: "warning", path: `${change.label}.seoTitle`, message: "SEO title missing" });
        if (!after.seoDescription) {
          issues.push({ level: "warning", path: `${change.label}.seoDescription`, message: "SEO description missing" });
        }
        if (!after.ctaLink) issues.push({ level: "warning", path: `${change.label}.ctaLink`, message: "CTA link missing" });
        if (!after.categoryId || !after.productTypeId) {
          issues.push({ level: "error", path: `${change.label}.taxonomy`, message: "Category and product type required" });
        }
        for (const plan of after.plans || []) {
          if (!plan.name) issues.push({ level: "error", path: `${change.label}.plan`, message: "Plan name required" });
          const hasPrice = plan.monthlyPrice != null || plan.yearlyPrice != null || plan.oneTimePrice != null;
          if (!hasPrice) {
            issues.push({ level: "warning", path: `${change.label}.${plan.name || "plan"}.price`, message: "Plan has no price" });
          }
          const titles = new Set();
          for (const f of plan.features || []) {
            if (!f.title) continue;
            if (titles.has(f.title)) {
              issues.push({
                level: "warning",
                path: `${change.label}.${plan.name}.${f.title}`,
                message: "Duplicate feature title",
              });
            }
            titles.add(f.title);
          }
        }
        if (after.visibleWebsite === false && change.changeType !== "create") {
          issues.push({ level: "warning", path: `${change.label}.visibility`, message: "Product will be hidden on website" });
        }
      }
    }

    if (!(session.changes || []).length) {
      issues.push({ level: "error", path: "session", message: "Sandbox has no changes to publish" });
    }

    const errorCount = issues.filter((i) => i.level === "error").length;
    const warningCount = issues.filter((i) => i.level === "warning").length;
    const report = await prisma.sandboxValidationReport.create({
      data: {
        sessionId,
        passed: errorCount === 0,
        errorCount,
        warningCount,
        reportJson: { issues, checkedAt: new Date().toISOString() },
      },
    });
    return { report, issues, passed: errorCount === 0, errorCount, warningCount };
  },

  async createPreviewToken(sessionId, { createdById, ttlHours = 24 } = {}) {
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + Math.max(1, Number(ttlHours) || 24) * 3600 * 1000);
    // Revoke previous active tokens when regenerating
    await prisma.sandboxPreviewToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return prisma.sandboxPreviewToken.create({
      data: {
        sessionId,
        token,
        expiresAt,
        createdById: createdById || null,
      },
    });
  },

  async resolvePreviewToken(token) {
    if (!token) return null;
    const row = await prisma.sandboxPreviewToken.findFirst({
      where: {
        token: String(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        session: { deletedAt: null, status: { not: "archived" } },
      },
      include: {
        session: {
          include: { changes: true },
        },
      },
    });
    if (!row) return null;
    await prisma.sandboxPreviewToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    return row;
  },

  /**
   * Apply sandbox overlays onto a public item list (preview only).
   */
  applyItemOverlays(liveItems, changes) {
    const itemChanges = (changes || []).filter((c) => c.entityType === "catalog_item");
    const byId = new Map(liveItems.map((i) => [i.id, i]));
    const result = [];

    for (const item of liveItems) {
      const change = itemChanges.find((c) => c.entityId === item.id);
      if (!change) {
        result.push(item);
        continue;
      }
      if (change.changeType === "delete") continue;
      result.push(this.mergeItem(item, change.afterJson));
    }

    for (const change of itemChanges) {
      if (change.changeType !== "create") continue;
      if (change.entityId && byId.has(change.entityId)) continue;
      result.push(this.mergeItem(null, change.afterJson));
    }
    return result;
  },

  mergeItem(live, after) {
    const base = live ? { ...live } : {};
    const a = after || {};
    return {
      ...base,
      id: a.id || base.id || `sandbox-${a.slug || "new"}`,
      name: a.name ?? base.name,
      slug: a.slug ?? base.slug,
      shortDescription: a.shortDescription ?? base.shortDescription,
      fullDescription: a.fullDescription ?? base.fullDescription,
      categoryId: a.categoryId ?? base.categoryId,
      productTypeId: a.productTypeId ?? base.productTypeId,
      displayOrder: a.displayOrder ?? base.displayOrder ?? 0,
      featured: a.featured ?? base.featured ?? false,
      accentColor: a.accentColor ?? base.accentColor,
      ctaText: a.ctaText ?? base.ctaText,
      ctaLink: a.ctaLink ?? base.ctaLink,
      seoTitle: a.seoTitle ?? base.seoTitle,
      seoDescription: a.seoDescription ?? base.seoDescription,
      comingSoon: a.comingSoon ?? base.comingSoon ?? false,
      countdownEnabled: a.countdownEnabled ?? base.countdownEnabled ?? false,
      notifyMeEnabled: a.notifyMeEnabled ?? base.notifyMeEnabled ?? false,
      workflowStatus: "preview",
      visibleWebsite: true,
      visibleAi: a.visibleAi ?? base.visibleAi ?? true,
      category: base.category,
      productType: base.productType,
      media: base.media || [],
      plans: (a.plans || base.plans || []).map((p) => ({
        ...p,
        monthlyPrice: p.monthlyPrice != null ? Number(p.monthlyPrice) : null,
        yearlyPrice: p.yearlyPrice != null ? Number(p.yearlyPrice) : null,
        oneTimePrice: p.oneTimePrice != null ? Number(p.oneTimePrice) : null,
        workflowStatus: "published",
        features: p.features || [],
      })),
      _sandbox: true,
    };
  },

  async schedulePublish(sessionId, { scheduledFor, timezone, createdById, publishMode = "replace" }) {
    const when = scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) throw new Error("Invalid schedule time");
    await this.update(sessionId, { status: "scheduled" });
    await prisma.sandboxPublishJob.updateMany({
      where: { sessionId, status: "pending" },
      data: { status: "cancelled" },
    });
    return prisma.sandboxPublishJob.create({
      data: {
        sessionId,
        status: "pending",
        publishMode,
        scheduledFor: when,
        timezone: timezone || "Asia/Karachi",
        createdById: createdById || null,
      },
    });
  },

  async publishNow(sessionId, { req, actorId } = {}) {
    const validation = await this.validate(sessionId);
    if (!validation.passed) {
      const err = new Error("Validation failed — fix errors before publishing");
      err.validation = validation;
      throw err;
    }
    const session = await this.get(sessionId);
    const publishedIds = [];

    for (const change of session.changes || []) {
      if (change.entityType !== "catalog_item") continue;
      const after = change.afterJson || {};
      if (change.changeType === "create" || !change.entityId) {
        const created = await catalog.createItem({
          name: after.name,
          slug: after.slug,
          shortDescription: after.shortDescription,
          fullDescription: after.fullDescription,
          categoryId: after.categoryId,
          productTypeId: after.productTypeId,
          displayOrder: after.displayOrder || 0,
          featured: Boolean(after.featured),
          accentColor: after.accentColor,
          ctaText: after.ctaText,
          ctaLink: after.ctaLink,
          seoTitle: after.seoTitle,
          seoDescription: after.seoDescription,
          comingSoon: Boolean(after.comingSoon),
          countdownEnabled: Boolean(after.countdownEnabled),
          notifyMeEnabled: Boolean(after.notifyMeEnabled),
          workflowStatus: "published",
          publishedAt: new Date(),
          visibleWebsite: after.visibleWebsite !== false,
          visibleAi: after.visibleAi !== false,
        });
        for (const [idx, plan] of (after.plans || []).entries()) {
          const createdPlan = await catalog.createPlan({
            itemId: created.id,
            name: plan.name,
            subtitle: plan.subtitle,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            oneTimePrice: plan.oneTimePrice,
            currency: plan.currency || "PKR",
            badge: plan.badge,
            popular: Boolean(plan.popular),
            recommended: Boolean(plan.recommended),
            color: plan.color,
            ctaText: plan.ctaText,
            ctaLink: plan.ctaLink,
            displayOrder: plan.displayOrder ?? idx,
            workflowStatus: "published",
            publishedAt: new Date(),
            visibleWebsite: true,
          });
          for (const [fIdx, feat] of (plan.features || []).entries()) {
            await catalog.createFeature({
              planId: createdPlan.id,
              title: feat.title,
              description: feat.description,
              included: feat.included !== false,
              valueText: feat.valueText,
              icon: feat.icon,
              displayOrder: feat.displayOrder ?? fIdx,
              enabled: feat.enabled !== false,
            });
          }
        }
        await versioning.createRevision({
          itemId: created.id,
          req,
          summaryHint: `Published from sandbox ${session.name}`,
          forceInitial: true,
        });
        publishedIds.push(created.id);
        await prisma.sandboxChange.update({
          where: { id: change.id },
          data: { entityId: created.id, changeType: "update" },
        });
      } else {
        await catalog.updateItem(change.entityId, {
          name: after.name,
          slug: after.slug,
          shortDescription: after.shortDescription,
          fullDescription: after.fullDescription,
          categoryId: after.categoryId,
          productTypeId: after.productTypeId,
          displayOrder: after.displayOrder,
          featured: Boolean(after.featured),
          accentColor: after.accentColor,
          ctaText: after.ctaText,
          ctaLink: after.ctaLink,
          seoTitle: after.seoTitle,
          seoDescription: after.seoDescription,
          comingSoon: Boolean(after.comingSoon),
          countdownEnabled: Boolean(after.countdownEnabled),
          notifyMeEnabled: Boolean(after.notifyMeEnabled),
          workflowStatus: "published",
          publishedAt: new Date(),
          publishAt: null,
          scheduledPayloadJson: null,
          visibleWebsite: after.visibleWebsite !== false,
          visibleAi: after.visibleAi !== false,
        });
        // Sync plans lightly: update existing by id, create missing
        const live = await catalog.getItem(change.entityId, { admin: true });
        const livePlans = live.plans || [];
        for (const [idx, plan] of (after.plans || []).entries()) {
          const existing = plan.id ? livePlans.find((p) => p.id === plan.id) : null;
          if (existing) {
            await catalog.updatePlan(existing.id, {
              name: plan.name,
              subtitle: plan.subtitle,
              monthlyPrice: plan.monthlyPrice,
              yearlyPrice: plan.yearlyPrice,
              oneTimePrice: plan.oneTimePrice,
              currency: plan.currency || existing.currency,
              badge: plan.badge,
              popular: Boolean(plan.popular),
              recommended: Boolean(plan.recommended),
              color: plan.color,
              ctaText: plan.ctaText,
              ctaLink: plan.ctaLink,
              displayOrder: plan.displayOrder ?? idx,
              workflowStatus: "published",
              publishedAt: new Date(),
              visibleWebsite: true,
            });
            // Replace features so production matches sandbox
            const liveFeatures = existing.features || [];
            for (const feat of liveFeatures) {
              if (feat.id) await catalog.deleteFeature?.(feat.id).catch(() => {});
            }
            // Soft-delete existing features via repository if available
            try {
              const { prisma } = require("../prisma");
              await prisma.planFeature.deleteMany({
                where: { planId: existing.id },
              });
            } catch (_e) {
              /* ignore */
            }
            for (const [fIdx, feat] of (plan.features || []).entries()) {
              await catalog.createFeature({
                planId: existing.id,
                title: feat.title,
                description: feat.description,
                included: feat.included !== false,
                valueText: feat.valueText,
                icon: feat.icon,
                displayOrder: feat.displayOrder ?? fIdx,
                enabled: feat.enabled !== false,
              });
            }
          } else {
            const createdPlan = await catalog.createPlan({
              itemId: change.entityId,
              name: plan.name,
              subtitle: plan.subtitle,
              monthlyPrice: plan.monthlyPrice,
              yearlyPrice: plan.yearlyPrice,
              oneTimePrice: plan.oneTimePrice,
              currency: plan.currency || "PKR",
              badge: plan.badge,
              popular: Boolean(plan.popular),
              recommended: Boolean(plan.recommended),
              color: plan.color,
              ctaText: plan.ctaText,
              ctaLink: plan.ctaLink,
              displayOrder: plan.displayOrder ?? idx,
              workflowStatus: "published",
              publishedAt: new Date(),
              visibleWebsite: true,
            });
            for (const [fIdx, feat] of (plan.features || []).entries()) {
              await catalog.createFeature({
                planId: createdPlan.id,
                title: feat.title,
                description: feat.description,
                included: feat.included !== false,
                valueText: feat.valueText,
                icon: feat.icon,
                displayOrder: feat.displayOrder ?? fIdx,
                enabled: feat.enabled !== false,
              });
            }
          }
        }
        // Soft-delete plans removed from sandbox snapshot
        const keepIds = new Set((after.plans || []).map((p) => p.id).filter(Boolean));
        for (const livePlan of livePlans) {
          if (keepIds.size && livePlan.id && !keepIds.has(livePlan.id)) {
            await catalog.updatePlan(livePlan.id, {
              workflowStatus: "archived",
              visibleWebsite: false,
              archivedAt: new Date(),
            }).catch(() => {});
          }
        }
        await versioning.createRevision({
          itemId: change.entityId,
          req,
          summaryHint: `Published from sandbox ${session.name}`,
        });
        publishedIds.push(change.entityId);
      }
    }

    await prisma.sandboxPublishJob.updateMany({
      where: { sessionId, status: "pending" },
      data: { status: "cancelled" },
    });
    await this.update(sessionId, { status: "published" });
    await prisma.sandboxPreviewToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { publishedIds, validation };
  },

  async runDuePublishJobs(now = new Date()) {
    const due = await prisma.sandboxPublishJob.findMany({
      where: { status: "pending", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      take: 10,
    });
    let done = 0;
    for (const job of due) {
      await prisma.sandboxPublishJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: now },
      });
      try {
        await this.publishNow(job.sessionId);
        await prisma.sandboxPublishJob.update({
          where: { id: job.id },
          data: { status: "completed", completedAt: new Date() },
        });
        done += 1;
      } catch (err) {
        await prisma.sandboxPublishJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: err.message || String(err),
            completedAt: new Date(),
          },
        });
      }
    }
    return done;
  },

  async rollbackItem(itemId, { req } = {}) {
    const revisions = await versioning.listRevisions(itemId);
    if (revisions.length < 2) throw new Error("No previous version to restore");
    const previous = revisions.find((r) => r.status !== "current") || revisions[1];
    await versioning.restoreVersion(itemId, previous.versionNumber, {
      req,
      reason: `Sandbox rollback to v${previous.versionNumber}`,
    });
    return previous;
  },
};

module.exports = { SandboxRepository, flattenItemSnapshot, diffFields };
