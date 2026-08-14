/**
 * Marketing promotional popups repository.
 */
const { prisma } = require("../prisma");

const notDeleted = { deletedAt: null };

const FREQUENCIES = new Set(["once_per_session", "once_per_day", "always"]);
const TARGETS = new Set(["homepage_only", "entire_website"]);

const WRITE_FIELDS = [
  "name",
  "title",
  "description",
  "imageUrl",
  "buttonText",
  "buttonUrl",
  "enabled",
  "startAt",
  "endAt",
  "displayFrequency",
  "delayMs",
  "targetPages",
  "priority",
];

function sanitizeWrite(data) {
  const out = {};
  for (const key of WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      out[key] = data[key] === "" ? null : data[key];
    }
  }
  if (out.displayFrequency && !FREQUENCIES.has(out.displayFrequency)) {
    out.displayFrequency = "once_per_session";
  }
  if (out.targetPages && !TARGETS.has(out.targetPages)) {
    out.targetPages = "homepage_only";
  }
  if (out.delayMs != null) {
    const n = Number(out.delayMs);
    out.delayMs = Number.isFinite(n) ? Math.max(0, Math.min(60000, Math.round(n))) : 800;
  }
  if (out.priority != null) {
    const n = Number(out.priority);
    out.priority = Number.isFinite(n) ? Math.round(n) : 100;
  }
  if (out.enabled != null) out.enabled = Boolean(out.enabled);
  return out;
}

function isWindowActive(row, now = new Date()) {
  if (row.startAt && new Date(row.startAt) > now) return false;
  if (row.endAt && new Date(row.endAt) < now) return false;
  return true;
}

function matchesPage(row, pagePath) {
  const target = String(row.targetPages || "homepage_only");
  if (target === "entire_website") return true;
  const path = String(pagePath || "/").split("?")[0] || "/";
  const normalized = path.replace(/\/index\.html$/i, "/").replace(/\/+$/, "") || "/";
  return normalized === "/" || normalized === "" || /^\/index\.html$/i.test(path);
}

function computeStatus(row, now = new Date()) {
  if (row.deletedAt) return "deleted";
  if (!row.enabled) return "draft";
  if (row.startAt && new Date(row.startAt) > now) return "scheduled";
  if (row.endAt && new Date(row.endAt) < now) return "expired";
  return "active";
}

const MarketingPopupRepository = {
  prisma,
  FREQUENCIES,
  TARGETS,
  computeStatus,
  isWindowActive,
  matchesPage,

  list({ q, status } = {}) {
    const where = { ...notDeleted };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ];
    }
    return prisma.marketingPopup
      .findMany({
        where,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      })
      .then((rows) => {
        const now = new Date();
        let list = rows.map((r) => ({ ...r, status: computeStatus(r, now) }));
        if (status) list = list.filter((r) => r.status === status);
        return list;
      });
  },

  get(id) {
    return prisma.marketingPopup.findFirst({ where: { id, ...notDeleted } }).then((row) => {
      if (!row) return null;
      return { ...row, status: computeStatus(row) };
    });
  },

  create(data) {
    const payload = sanitizeWrite(data);
    if (!payload.name) throw new Error("Name is required");
    if (payload.displayFrequency == null) payload.displayFrequency = "once_per_session";
    if (payload.targetPages == null) payload.targetPages = "homepage_only";
    if (payload.delayMs == null) payload.delayMs = 800;
    if (payload.priority == null) payload.priority = 100;
    if (payload.enabled == null) payload.enabled = false;
    return prisma.marketingPopup.create({ data: payload });
  },

  async update(id, data) {
    const existing = await prisma.marketingPopup.findFirst({ where: { id, ...notDeleted } });
    if (!existing) throw new Error("Popup not found");
    const payload = sanitizeWrite(data);
    return prisma.marketingPopup.update({ where: { id }, data: payload });
  },

  async setEnabled(id, enabled) {
    const existing = await prisma.marketingPopup.findFirst({ where: { id, ...notDeleted } });
    if (!existing) throw new Error("Popup not found");
    return prisma.marketingPopup.update({
      where: { id },
      data: { enabled: Boolean(enabled) },
    });
  },

  async softDelete(id) {
    const existing = await prisma.marketingPopup.findFirst({ where: { id, ...notDeleted } });
    if (!existing) return null;
    return prisma.marketingPopup.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  },

  /**
   * Public: enabled + in window + matching page, highest priority first (lower number = higher priority).
   */
  async listActive({ pagePath } = {}) {
    const now = new Date();
    const rows = await prisma.marketingPopup.findMany({
      where: {
        ...notDeleted,
        enabled: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 20,
    });
    return rows.filter((r) => matchesPage(r, pagePath));
  },

  async upsertByName(name, data) {
    const existing = await prisma.marketingPopup.findFirst({
      where: { name, ...notDeleted },
    });
    if (existing) {
      return prisma.marketingPopup.update({
        where: { id: existing.id },
        data: sanitizeWrite({ ...data, name }),
      });
    }
    return this.create({ ...data, name });
  },
};

module.exports = { MarketingPopupRepository };
