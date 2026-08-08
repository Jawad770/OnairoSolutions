/**
 * Catalog Manager repositories — direct Prisma, outside the in-memory state layer.
 */
const { prisma } = require("../prisma");

const notDeleted = { deletedAt: null };

function publicItemWhere(channel = "website") {
  const where = {
    ...notDeleted,
    visibleHidden: false,
    OR: [{ workflowStatus: "published" }, { comingSoon: true, visibleComingSoon: true, workflowStatus: { in: ["published", "preview"] } }],
  };
  if (channel === "website") where.visibleWebsite = true;
  if (channel === "ai") where.visibleAi = true;
  return where;
}

function decimalToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

function serializePlan(plan) {
  if (!plan) return null;
  return {
    ...plan,
    monthlyPrice: decimalToNumber(plan.monthlyPrice),
    yearlyPrice: decimalToNumber(plan.yearlyPrice),
    oneTimePrice: decimalToNumber(plan.oneTimePrice),
    features: (plan.features || []).filter((f) => !f.deletedAt && f.enabled !== false),
  };
}

function serializeItem(item) {
  if (!item) return null;
  return {
    ...item,
    plans: (item.plans || [])
      .filter((p) => !p.deletedAt && !p.archivedAt)
      .map(serializePlan),
    media: (item.media || []).filter((m) => !m.deletedAt && m.enabled !== false),
    changelogs: (item.changelogs || []).filter((c) => !c.deletedAt),
  };
}

const CatalogRepository = {
  prisma,

  /* ---------- taxonomy ---------- */
  listCategories({ includeDisabled = false } = {}) {
    const where = { ...notDeleted };
    if (!includeDisabled) where.enabled = true;
    return prisma.catalogCategory.findMany({ where, orderBy: { displayOrder: "asc" } });
  },
  getCategory(id) {
    return prisma.catalogCategory.findFirst({ where: { id, ...notDeleted } });
  },
  getCategoryBySlug(slug) {
    return prisma.catalogCategory.findFirst({ where: { slug, ...notDeleted } });
  },
  createCategory(data) {
    return prisma.catalogCategory.create({ data });
  },
  updateCategory(id, data) {
    return prisma.catalogCategory.update({ where: { id }, data });
  },
  softDeleteCategory(id) {
    return prisma.catalogCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  listTypes({ includeDisabled = false } = {}) {
    const where = { ...notDeleted };
    if (!includeDisabled) where.enabled = true;
    return prisma.productType.findMany({ where, orderBy: { displayOrder: "asc" } });
  },
  getType(id) {
    return prisma.productType.findFirst({ where: { id, ...notDeleted } });
  },
  getTypeBySlug(slug) {
    return prisma.productType.findFirst({ where: { slug, ...notDeleted } });
  },
  createType(data) {
    return prisma.productType.create({ data });
  },
  updateType(id, data) {
    return prisma.productType.update({ where: { id }, data });
  },
  softDeleteType(id) {
    return prisma.productType.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  /* ---------- items ---------- */
  listItems({ q, status, categoryId, includeDeleted = false, admin = false } = {}) {
    const where = includeDeleted ? {} : { ...notDeleted };
    if (status) where.workflowStatus = status;
    if (categoryId) where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
      ];
    }
    return prisma.catalogItem.findMany({
      where,
      include: {
        category: true,
        productType: true,
        plans: admin
          ? { where: notDeleted, orderBy: { displayOrder: "asc" }, include: { features: { where: notDeleted, orderBy: { displayOrder: "asc" } } } }
          : { where: { ...notDeleted, workflowStatus: "published", archivedAt: null }, orderBy: { displayOrder: "asc" } },
      },
      orderBy: { displayOrder: "asc" },
    });
  },

  listPublicItems(channel = "website", { categorySlug, typeSlug } = {}) {
    const where = publicItemWhere(channel);
    if (categorySlug) where.category = { slug: categorySlug, deletedAt: null };
    if (typeSlug) where.productType = { slug: typeSlug, deletedAt: null };
    return prisma.catalogItem.findMany({
      where,
      include: {
        category: true,
        productType: true,
        plans: {
          where: { ...notDeleted, archivedAt: null, workflowStatus: "published", visibleWebsite: true },
          orderBy: { displayOrder: "asc" },
          include: { features: { where: { ...notDeleted, enabled: true }, orderBy: { displayOrder: "asc" } } },
        },
        media: { where: { ...notDeleted, enabled: true }, orderBy: { displayOrder: "asc" } },
        changelogs: { where: { ...notDeleted, visibleWebsite: true }, orderBy: [{ releasedAt: "desc" }, { displayOrder: "asc" }], take: 20 },
      },
      orderBy: { displayOrder: "asc" },
    }).then((rows) => rows.map(serializeItem));
  },

  getItem(id, { admin = false } = {}) {
    return prisma.catalogItem.findFirst({
      where: { id, ...(admin ? {} : notDeleted) },
      include: {
        category: true,
        productType: true,
        plans: {
          where: notDeleted,
          orderBy: { displayOrder: "asc" },
          include: { features: { where: notDeleted, orderBy: { displayOrder: "asc" } } },
        },
        media: { where: notDeleted, orderBy: { displayOrder: "asc" } },
        changelogs: { where: notDeleted, orderBy: { releasedAt: "desc" } },
        campaigns: { where: notDeleted },
      },
    });
  },

  getItemBySlug(slug, { channel = "website", admin = false } = {}) {
    const where = admin ? { slug, ...notDeleted } : { slug, ...publicItemWhere(channel) };
    return prisma.catalogItem
      .findFirst({
        where,
        include: {
          category: true,
          productType: true,
          plans: {
            where: admin
              ? notDeleted
              : { ...notDeleted, archivedAt: null, workflowStatus: "published", visibleWebsite: true },
            orderBy: { displayOrder: "asc" },
            include: { features: { where: { ...notDeleted, ...(admin ? {} : { enabled: true }) }, orderBy: { displayOrder: "asc" } } },
          },
          media: { where: { ...notDeleted, ...(admin ? {} : { enabled: true }) }, orderBy: { displayOrder: "asc" } },
          changelogs: {
            where: { ...notDeleted, ...(admin ? {} : { visibleWebsite: true }) },
            orderBy: [{ releasedAt: "desc" }, { displayOrder: "asc" }],
          },
        },
      })
      .then((item) => (admin ? item : serializeItem(item)));
  },

  createItem(data) {
    return prisma.catalogItem.create({ data });
  },
  updateItem(id, data) {
    return prisma.catalogItem.update({ where: { id }, data });
  },
  softDeleteItem(id) {
    return prisma.catalogItem.update({ where: { id }, data: { deletedAt: new Date(), workflowStatus: "archived" } });
  },

  /* ---------- plans ---------- */
  getPlan(id) {
    return prisma.catalogPlan.findFirst({
      where: { id, ...notDeleted },
      include: { features: { where: notDeleted, orderBy: { displayOrder: "asc" } }, item: true },
    });
  },
  createPlan(data) {
    return prisma.catalogPlan.create({ data });
  },
  updatePlan(id, data) {
    return prisma.catalogPlan.update({ where: { id }, data });
  },
  softDeletePlan(id) {
    return prisma.catalogPlan.update({ where: { id }, data: { deletedAt: new Date(), archivedAt: new Date() } });
  },
  async duplicatePlan(id) {
    const plan = await this.getPlan(id);
    if (!plan) return null;
    const copy = await prisma.catalogPlan.create({
      data: {
        itemId: plan.itemId,
        name: `${plan.name} (Copy)`,
        subtitle: plan.subtitle,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        oneTimePrice: plan.oneTimePrice,
        currency: plan.currency,
        badge: plan.badge,
        popular: false,
        recommended: false,
        color: plan.color,
        icon: plan.icon,
        displayOrder: plan.displayOrder + 1,
        ctaText: plan.ctaText,
        ctaLink: plan.ctaLink,
        workflowStatus: "draft",
        visibleWebsite: plan.visibleWebsite,
      },
    });
    if (plan.features?.length) {
      await prisma.planFeature.createMany({
        data: plan.features.map((f, i) => ({
          planId: copy.id,
          title: f.title,
          description: f.description,
          included: f.included,
          valueText: f.valueText,
          icon: f.icon,
          displayOrder: f.displayOrder ?? i,
          enabled: f.enabled,
        })),
      });
    }
    return this.getPlan(copy.id);
  },

  /* ---------- features ---------- */
  createFeature(data) {
    return prisma.planFeature.create({ data });
  },
  updateFeature(id, data) {
    return prisma.planFeature.update({ where: { id }, data });
  },
  softDeleteFeature(id) {
    return prisma.planFeature.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  /* ---------- media ---------- */
  createMedia(data) {
    return prisma.catalogMedia.create({ data });
  },
  updateMedia(id, data) {
    return prisma.catalogMedia.update({ where: { id }, data });
  },
  softDeleteMedia(id) {
    return prisma.catalogMedia.update({ where: { id }, data: { deletedAt: new Date() } });
  },
  async reorderMedia(orderedIds) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.catalogMedia.update({ where: { id }, data: { displayOrder: index } })
      )
    );
  },

  /* ---------- changelog ---------- */
  createChangelog(data) {
    return prisma.catalogChangelog.create({ data });
  },
  updateChangelog(id, data) {
    return prisma.catalogChangelog.update({ where: { id }, data });
  },
  softDeleteChangelog(id) {
    return prisma.catalogChangelog.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  /* ---------- campaigns ---------- */
  listCampaigns() {
    return prisma.catalogCampaign.findMany({
      where: notDeleted,
      include: { item: true },
      orderBy: { createdAt: "desc" },
    });
  },
  createCampaign(data) {
    return prisma.catalogCampaign.create({ data });
  },
  updateCampaign(id, data) {
    return prisma.catalogCampaign.update({ where: { id }, data });
  },
  softDeleteCampaign(id) {
    return prisma.catalogCampaign.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  /* ---------- notify ---------- */
  createNotifyInterest(data) {
    return prisma.catalogNotifyInterest.create({ data });
  },
  listNotifyInterests({ itemId } = {}) {
    const where = {};
    if (itemId) where.itemId = itemId;
    return prisma.catalogNotifyInterest.findMany({
      where,
      include: { item: true },
      orderBy: { createdAt: "desc" },
    });
  },

  /* ---------- scheduling ---------- */
  listDueScheduledItems(now = new Date()) {
    return prisma.catalogItem.findMany({
      where: {
        ...notDeleted,
        publishAt: { lte: now },
        workflowStatus: { in: ["draft", "preview"] },
      },
    });
  },
  listDueScheduledPlans(now = new Date()) {
    return prisma.catalogPlan.findMany({
      where: {
        ...notDeleted,
        publishAt: { lte: now },
        workflowStatus: { in: ["draft", "preview"] },
        archivedAt: null,
      },
    });
  },

  async reorderItems(orderedIds) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.catalogItem.update({ where: { id }, data: { displayOrder: index } })
      )
    );
  },
  async reorderPlans(orderedIds) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.catalogPlan.update({ where: { id }, data: { displayOrder: index } })
      )
    );
  },
  async reorderFeatures(orderedIds) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.planFeature.update({ where: { id }, data: { displayOrder: index } })
      )
    );
  },

  /** Website Services packages for /api/catalog/pricing */
  async listWebsitePackages() {
    const cat = await prisma.catalogCategory.findFirst({
      where: { slug: "website-services", ...notDeleted },
    });
    if (!cat) return [];
    return this.listPublicItems("website", { categorySlug: "website-services" });
  },

  serializeItem,
  serializePlan,
};

module.exports = { CatalogRepository };
