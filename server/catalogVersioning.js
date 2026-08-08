/**
 * Catalog Product Versioning — immutable revisions of item + plans + features.
 * Does not touch Downloads ProductVersion.
 */
const { prisma } = require("./db/prisma");
const { hashIp } = require("./db");
const { audit } = require("./audit");

const ITEM_FIELDS = [
  "name",
  "slug",
  "shortDescription",
  "fullDescription",
  "categoryId",
  "productTypeId",
  "displayOrder",
  "featured",
  "accentColor",
  "ctaText",
  "ctaLink",
  "seoTitle",
  "seoDescription",
  "comingSoon",
  "expectedLaunchAt",
  "comingSoonDescription",
  "countdownEnabled",
  "notifyMeEnabled",
  "workflowStatus",
  "visibleWebsite",
  "visibleAi",
  "visibleCustomerPortal",
  "visibleCrm",
  "visibleDownloads",
  "visibleInternal",
  "visibleComingSoon",
  "visibleHidden",
  "visibleFutureRelease",
];

const PLAN_FIELDS = [
  "name",
  "subtitle",
  "monthlyPrice",
  "yearlyPrice",
  "oneTimePrice",
  "currency",
  "badge",
  "popular",
  "recommended",
  "color",
  "icon",
  "displayOrder",
  "ctaText",
  "ctaLink",
  "workflowStatus",
  "visibleWebsite",
];

const FEATURE_FIELDS = ["title", "description", "included", "valueText", "icon", "displayOrder", "enabled"];

function decimalToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function normalizeScalar(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && typeof v.toNumber === "function") return Number(v);
  if (typeof v === "number" && Number.isNaN(v)) return null;
  return v;
}

function pick(obj, fields) {
  const out = {};
  for (const f of fields) out[f] = normalizeScalar(obj?.[f]);
  return out;
}

function graphFromItem(item) {
  if (!item) return null;
  return {
    item: {
      id: item.id,
      ...pick(item, ITEM_FIELDS),
    },
    plans: (item.plans || [])
      .filter((p) => !p.deletedAt)
      .map((p) => ({
        id: p.id,
        ...pick(p, PLAN_FIELDS),
        monthlyPrice: decimalToNumber(p.monthlyPrice),
        yearlyPrice: decimalToNumber(p.yearlyPrice),
        oneTimePrice: decimalToNumber(p.oneTimePrice),
        features: (p.features || [])
          .filter((f) => !f.deletedAt)
          .map((f) => ({
            id: f.id,
            ...pick(f, FEATURE_FIELDS),
          })),
      })),
  };
}

async function loadGraph(itemId) {
  const item = await prisma.catalogItem.findFirst({
    where: { id: itemId },
    include: {
      plans: {
        where: { deletedAt: null },
        orderBy: { displayOrder: "asc" },
        include: {
          features: { where: { deletedAt: null }, orderBy: { displayOrder: "asc" } },
        },
      },
    },
  });
  return graphFromItem(item);
}

function valuesEqual(a, b) {
  const na = normalizeScalar(a);
  const nb = normalizeScalar(b);
  if (na === nb) return true;
  if (na == null && nb == null) return true;
  if (typeof na === "number" && typeof nb === "number") return Math.abs(na - nb) < 0.00001;
  return JSON.stringify(na) === JSON.stringify(nb);
}

function pushFieldChanges(changes, entityType, entityKey, beforeObj, afterObj, fields) {
  for (const field of fields) {
    const before = beforeObj ? beforeObj[field] : undefined;
    const after = afterObj ? afterObj[field] : undefined;
    if (beforeObj && afterObj) {
      if (!valuesEqual(before, after)) {
        changes.push({
          entityType,
          entityKey,
          field,
          changeType: "modified",
          beforeJson: normalizeScalar(before),
          afterJson: normalizeScalar(after),
        });
      }
    } else if (!beforeObj && afterObj) {
      if (after != null && after !== "" && after !== false) {
        changes.push({
          entityType,
          entityKey,
          field,
          changeType: "added",
          beforeJson: null,
          afterJson: normalizeScalar(after),
        });
      }
    } else if (beforeObj && !afterObj) {
      changes.push({
        entityType,
        entityKey,
        field,
        changeType: "removed",
        beforeJson: normalizeScalar(before),
        afterJson: null,
      });
    }
  }
}

function diffGraphs(prev, next) {
  const changes = [];
  if (!prev && next) {
    pushFieldChanges(changes, "item", next.item.slug || next.item.name, null, next.item, ITEM_FIELDS);
    for (const plan of next.plans || []) {
      pushFieldChanges(changes, "plan", plan.name, null, plan, PLAN_FIELDS);
      for (const feat of plan.features || []) {
        pushFieldChanges(changes, "feature", `${plan.name}::${feat.title}`, null, feat, FEATURE_FIELDS);
      }
    }
    return changes;
  }
  if (!next) return changes;

  pushFieldChanges(changes, "item", next.item.slug || next.item.name, prev.item, next.item, ITEM_FIELDS);

  const prevPlans = new Map((prev.plans || []).map((p) => [p.id || p.name, p]));
  const nextPlans = new Map((next.plans || []).map((p) => [p.id || p.name, p]));
  const planKeys = new Set([...prevPlans.keys(), ...nextPlans.keys()]);

  for (const key of planKeys) {
    const before = prevPlans.get(key);
    const after = nextPlans.get(key);
    const entityKey = (after || before).name;
    if (!before && after) {
      pushFieldChanges(changes, "plan", entityKey, null, after, PLAN_FIELDS);
      for (const feat of after.features || []) {
        pushFieldChanges(changes, "feature", `${entityKey}::${feat.title}`, null, feat, FEATURE_FIELDS);
      }
      continue;
    }
    if (before && !after) {
      pushFieldChanges(changes, "plan", entityKey, before, null, PLAN_FIELDS);
      for (const feat of before.features || []) {
        pushFieldChanges(changes, "feature", `${entityKey}::${feat.title}`, feat, null, FEATURE_FIELDS);
      }
      continue;
    }
    pushFieldChanges(changes, "plan", entityKey, before, after, PLAN_FIELDS);
    const prevFeats = new Map((before.features || []).map((f) => [f.id || f.title, f]));
    const nextFeats = new Map((after.features || []).map((f) => [f.id || f.title, f]));
    const featKeys = new Set([...prevFeats.keys(), ...nextFeats.keys()]);
    for (const fk of featKeys) {
      const fb = prevFeats.get(fk);
      const fa = nextFeats.get(fk);
      const fKey = `${entityKey}::${(fa || fb).title}`;
      if (!fb && fa) pushFieldChanges(changes, "feature", fKey, null, fa, FEATURE_FIELDS);
      else if (fb && !fa) pushFieldChanges(changes, "feature", fKey, fb, null, FEATURE_FIELDS);
      else pushFieldChanges(changes, "feature", fKey, fb, fa, FEATURE_FIELDS);
    }
  }

  return changes;
}

function summarizeChanges(changes, itemName, { restoredFromVersion, summaryHint } = {}) {
  if (summaryHint) return summaryHint;
  if (restoredFromVersion != null) return `Restored Version ${restoredFromVersion}`;
  if (!changes.length) return `Updated ${itemName || "product"}`;

  const price = changes.find(
    (c) => c.entityType === "plan" && ["monthlyPrice", "yearlyPrice", "oneTimePrice"].includes(c.field) && c.changeType === "modified"
  );
  if (price) return `${price.entityKey} Price Updated`;

  const featAdd = changes.find((c) => c.entityType === "feature" && c.field === "title" && c.changeType === "added");
  if (featAdd) {
    const title = String(featAdd.afterJson || featAdd.entityKey.split("::").pop());
    return `Added ${title}`;
  }
  const featRem = changes.find((c) => c.entityType === "feature" && c.changeType === "removed" && c.field === "title");
  if (featRem) {
    const title = String(featRem.beforeJson || featRem.entityKey.split("::").pop());
    return `Removed ${title}`;
  }
  const badge = changes.find((c) => c.field === "badge" && c.changeType === "modified" && c.afterJson);
  if (badge) return `New ${badge.afterJson} Badge`;

  if (!changes.some((c) => c.entityType !== "item") && changes.every((c) => c.changeType === "added")) {
    return "Initial Release";
  }
  return `Updated ${itemName || "product"}`;
}

async function nextVersionNumber(itemId) {
  const last = await prisma.catalogRevision.findFirst({
    where: { itemId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber || 0) + 1;
}

async function getRevision(itemId, versionNumber) {
  return prisma.catalogRevision.findFirst({
    where: { itemId, versionNumber },
    include: { changes: { orderBy: { createdAt: "asc" } } },
  });
}

async function listRevisions(itemId) {
  return prisma.catalogRevision.findMany({
    where: { itemId },
    orderBy: { versionNumber: "desc" },
    include: { changes: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Capture a new revision from the current live graph.
 * Skips when there are no diffs vs previous snapshot (unless forceInitial).
 */
async function createRevision({
  itemId,
  req = null,
  reason = null,
  summaryHint = null,
  restoredFromVersion = null,
  forceInitial = false,
  previousGraph = null,
} = {}) {
  const next = await loadGraph(itemId);
  if (!next) return null;

  const current = await prisma.catalogRevision.findFirst({
    where: { itemId, status: "current" },
    orderBy: { versionNumber: "desc" },
  });

  let prev = previousGraph;
  if (!prev && current?.snapshotJson) {
    prev = current.snapshotJson;
  }

  const changes = diffGraphs(prev, next);
  if (!changes.length && !forceInitial && restoredFromVersion == null) {
    return current || null;
  }

  const versionNumber = await nextVersionNumber(itemId);
  const isFirst = versionNumber === 1 && !prev;
  const summary = isFirst && !summaryHint && restoredFromVersion == null
    ? "Initial Release"
    : summarizeChanges(changes, next.item.name, { restoredFromVersion, summaryHint });

  const actor = req?.session?.user || null;
  const status = restoredFromVersion != null ? "current" : "current";

  const revision = await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.catalogRevision.update({
        where: { id: current.id },
        data: { status: restoredFromVersion != null ? "historical" : "historical" },
      });
      // Also mark any other current rows (safety)
      await tx.catalogRevision.updateMany({
        where: { itemId, status: "current", id: { not: current.id } },
        data: { status: "historical" },
      });
    }

    const created = await tx.catalogRevision.create({
      data: {
        itemId,
        versionNumber,
        summary,
        status,
        snapshotJson: next,
        createdByUserId: actor?.id ?? null,
        createdByEmail: actor?.email ?? null,
        reason: reason || null,
        ipHash: req ? hashIp(req.ip) : null,
        userAgent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 500) : null,
        restoredFromVersion: restoredFromVersion ?? null,
        changes: {
          create: changes.map((c) => ({
            entityType: c.entityType,
            entityKey: c.entityKey,
            field: c.field,
            changeType: c.changeType,
            beforeJson: c.beforeJson ?? null,
            afterJson: c.afterJson ?? null,
          })),
        },
      },
      include: { changes: true },
    });

    await tx.catalogItem.update({
      where: { id: itemId },
      data: { currentRevisionId: created.id },
    });

    return created;
  });

  if (req) {
    audit(req, restoredFromVersion != null ? "CATALOG_VERSION_RESTORED" : "CATALOG_VERSION_CREATED", {
      targetType: "catalog_item",
      targetId: itemId,
      next: {
        versionNumber: revision.versionNumber,
        summary: revision.summary,
        restoredFromVersion,
        changeCount: changes.length,
      },
    });
  }

  return revision;
}

async function applySnapshot(itemId, snapshot) {
  if (!snapshot?.item) throw new Error("Invalid snapshot");
  const now = new Date();
  const itemData = pick(snapshot.item, ITEM_FIELDS.filter((f) => f !== "slug"));
  // Keep slug stable unless restoring intentionally includes it
  itemData.slug = snapshot.item.slug;
  itemData.workflowStatus = "published";
  itemData.publishedAt = now;
  itemData.expectedLaunchAt = snapshot.item.expectedLaunchAt ? new Date(snapshot.item.expectedLaunchAt) : null;

  await prisma.catalogItem.update({
    where: { id: itemId },
    data: itemData,
  });

  const livePlans = await prisma.catalogPlan.findMany({
    where: { itemId, deletedAt: null },
    include: { features: { where: { deletedAt: null } } },
  });
  const snapPlans = snapshot.plans || [];
  const usedLiveIds = new Set();

  for (const sp of snapPlans) {
    let live = livePlans.find((p) => p.id === sp.id) || livePlans.find((p) => p.name === sp.name && !usedLiveIds.has(p.id));
    const planPayload = {
      ...pick(sp, PLAN_FIELDS.filter((f) => f !== "name")),
      name: sp.name,
      monthlyPrice: sp.monthlyPrice,
      yearlyPrice: sp.yearlyPrice,
      oneTimePrice: sp.oneTimePrice,
      workflowStatus: "published",
      publishedAt: now,
      archivedAt: null,
      deletedAt: null,
    };

    if (live) {
      usedLiveIds.add(live.id);
      await prisma.catalogPlan.update({ where: { id: live.id }, data: planPayload });
    } else {
      live = await prisma.catalogPlan.create({
        data: { itemId, ...planPayload },
      });
      usedLiveIds.add(live.id);
      live = { ...live, features: [] };
    }

    const liveFeats = await prisma.planFeature.findMany({ where: { planId: live.id, deletedAt: null } });
    const usedFeatIds = new Set();
    for (const sf of sp.features || []) {
      let lf = liveFeats.find((f) => f.id === sf.id) || liveFeats.find((f) => f.title === sf.title && !usedFeatIds.has(f.id));
      const featPayload = {
        ...pick(sf, FEATURE_FIELDS.filter((f) => f !== "title")),
        title: sf.title,
        deletedAt: null,
      };
      if (lf) {
        usedFeatIds.add(lf.id);
        await prisma.planFeature.update({ where: { id: lf.id }, data: featPayload });
      } else {
        const created = await prisma.planFeature.create({
          data: { planId: live.id, ...featPayload },
        });
        usedFeatIds.add(created.id);
      }
    }
    for (const lf of liveFeats) {
      if (!usedFeatIds.has(lf.id)) {
        await prisma.planFeature.update({ where: { id: lf.id }, data: { deletedAt: now } });
      }
    }
  }

  for (const lp of livePlans) {
    if (!usedLiveIds.has(lp.id)) {
      await prisma.catalogPlan.update({
        where: { id: lp.id },
        data: { deletedAt: now, archivedAt: now, workflowStatus: "archived" },
      });
    }
  }

  return loadGraph(itemId);
}

async function restoreVersion(itemId, versionNumber, { req, reason } = {}) {
  const revision = await getRevision(itemId, Number(versionNumber));
  if (!revision) throw new Error("Version not found");
  const snapshot = revision.snapshotJson;
  await applySnapshot(itemId, snapshot);
  return createRevision({
    itemId,
    req,
    reason: reason || `Restored from version ${versionNumber}`,
    restoredFromVersion: Number(versionNumber),
    previousGraph: null, // diff against pre-restore current will be computed from DB current before apply... 
    // After apply, live matches snapshot; previous current revision snapshot is the "before".
    // Force capture by passing the revision we restored FROM as previous? Actually we want
    // changes showing what restored relative to what was current before restore.
  }).then(async (created) => {
    // Re-diff properly: before = previous current snapshot, after = restored
    return created;
  });
}

/**
 * Restore with correct before/after: capture previous graph first, apply, then revision.
 */
async function restoreVersionSafe(itemId, versionNumber, { req, reason } = {}) {
  const revision = await getRevision(itemId, Number(versionNumber));
  if (!revision) throw new Error("Version not found");
  const previousGraph = await loadGraph(itemId);
  await applySnapshot(itemId, revision.snapshotJson);
  return createRevision({
    itemId,
    req,
    reason: reason || `Restored from version ${versionNumber}`,
    restoredFromVersion: Number(versionNumber),
    previousGraph,
    forceInitial: false,
  });
}

function compareSnapshots(aSnap, bSnap) {
  return diffGraphs(aSnap, bSnap);
}

async function ensureBaseline(itemId, { req, summaryHint = "Baseline" } = {}) {
  const count = await prisma.catalogRevision.count({ where: { itemId } });
  if (count > 0) return null;
  return createRevision({ itemId, req, summaryHint, forceInitial: true });
}

async function backfillAllBaselines() {
  const items = await prisma.catalogItem.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let n = 0;
  for (const item of items) {
    const created = await ensureBaseline(item.id, { summaryHint: "Initial Release" });
    if (created) n += 1;
  }
  return n;
}

module.exports = {
  loadGraph,
  graphFromItem,
  diffGraphs,
  createRevision,
  applySnapshot,
  restoreVersion: restoreVersionSafe,
  getRevision,
  listRevisions,
  compareSnapshots,
  ensureBaseline,
  backfillAllBaselines,
  summarizeChanges,
};
