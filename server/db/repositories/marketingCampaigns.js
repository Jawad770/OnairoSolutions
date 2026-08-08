/**
 * Marketing Campaign Manager repository.
 */
const { prisma } = require("../prisma");
const { hashIp } = require("../../db");

const notDeleted = { deletedAt: null };

function decimalToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    discountValue: decimalToNumber(row.discountValue),
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const includeFull = {
  products: { include: { item: true } },
  plans: { include: { plan: true } },
  categories: { include: { category: true } },
  promotion: true,
};

function isWindowActive(c, now = new Date()) {
  if (c.startsAt && new Date(c.startsAt) > now) return false;
  if (c.endsAt && new Date(c.endsAt) < now) return false;
  return true;
}

const WRITE_FIELDS = [
  "name",
  "slug",
  "internalNotes",
  "campaignType",
  "status",
  "headline",
  "subHeading",
  "description",
  "promotionBadge",
  "buttonText",
  "buttonLink",
  "bannerImageUrl",
  "backgroundImageUrl",
  "themeColor",
  "accentColor",
  "icon",
  "animationStyle",
  "discountType",
  "discountValue",
  "discountCode",
  "autoApplyDiscount",
  "promotionId",
  "startsAt",
  "endsAt",
  "timezone",
  "showCountdown",
  "bannerPlacement",
  "bannerScope",
  "dismissible",
  "persistent",
  "animated",
  "audience",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "trackingJson",
  "publishedAt",
];

function sanitizeCampaignWrite(data) {
  const out = {};
  for (const key of WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      out[key] = data[key] === "" ? null : data[key];
    }
  }
  if (out.promotionId === "") out.promotionId = null;
  return out;
}

const MarketingCampaignRepository = {
  prisma,
  slugify,

  list({ status, q } = {}) {
    const where = { ...notDeleted };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
      ];
    }
    return prisma.marketingCampaign
      .findMany({
        where,
        include: includeFull,
        orderBy: [{ status: "asc" }, { startsAt: "desc" }, { createdAt: "desc" }],
      })
      .then((rows) => rows.map(serialize));
  },

  get(id) {
    return prisma.marketingCampaign
      .findFirst({ where: { id, ...notDeleted }, include: includeFull })
      .then(serialize);
  },

  getBySlug(slug, { admin = false } = {}) {
    return prisma.marketingCampaign
      .findFirst({
        where: { slug, ...(admin ? notDeleted : { ...notDeleted, status: "published" }) },
        include: includeFull,
      })
      .then(serialize);
  },

  async create(data, { productIds = [], planIds = [], categoryIds = [] } = {}) {
    let slug = slugify(data.slug || data.name);
    const clash = await prisma.marketingCampaign.findFirst({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const payload = sanitizeCampaignWrite(data);
    if (payload.status === "published" && !payload.publishedAt) payload.publishedAt = new Date();
    return prisma.marketingCampaign
      .create({
        data: {
          ...payload,
          slug,
          products: productIds.length ? { create: productIds.map((itemId) => ({ itemId })) } : undefined,
          plans: planIds.length ? { create: planIds.map((planId) => ({ planId })) } : undefined,
          categories: categoryIds.length
            ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
            : undefined,
        },
        include: includeFull,
      })
      .then(serialize);
  },

  async update(id, data, { productIds, planIds, categoryIds } = {}) {
    const payload = sanitizeCampaignWrite(data);
    if (payload.slug) payload.slug = slugify(payload.slug);
    if (payload.status === "published" && !payload.publishedAt) payload.publishedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.marketingCampaign.update({ where: { id }, data: payload });
      if (Array.isArray(productIds)) {
        await tx.marketingCampaignProduct.deleteMany({ where: { campaignId: id } });
        if (productIds.length) {
          await tx.marketingCampaignProduct.createMany({
            data: productIds.map((itemId) => ({ campaignId: id, itemId })),
          });
        }
      }
      if (Array.isArray(planIds)) {
        await tx.marketingCampaignPlan.deleteMany({ where: { campaignId: id } });
        if (planIds.length) {
          await tx.marketingCampaignPlan.createMany({
            data: planIds.map((planId) => ({ campaignId: id, planId })),
          });
        }
      }
      if (Array.isArray(categoryIds)) {
        await tx.marketingCampaignCategory.deleteMany({ where: { campaignId: id } });
        if (categoryIds.length) {
          await tx.marketingCampaignCategory.createMany({
            data: categoryIds.map((categoryId) => ({ campaignId: id, categoryId })),
          });
        }
      }
    });
    return this.get(id);
  },

  async duplicate(id) {
    const src = await this.get(id);
    if (!src) return null;
    const { id: _id, createdAt, updatedAt, deletedAt, publishedAt, viewCount, bannerClickCount, ctaClickCount, products, plans, categories, promotion, ...rest } = src;
    return this.create(
      {
        ...rest,
        name: `${src.name} (Copy)`,
        slug: `${src.slug}-copy`,
        status: "draft",
        viewCount: 0,
        bannerClickCount: 0,
        ctaClickCount: 0,
        publishedAt: null,
      },
      {
        productIds: (products || []).map((p) => p.itemId),
        planIds: (plans || []).map((p) => p.planId),
        categoryIds: (categories || []).map((c) => c.categoryId),
      }
    );
  },

  setStatus(id, status, extra = {}) {
    const data = { status, ...extra };
    if (status === "published") data.publishedAt = new Date();
    return prisma.marketingCampaign.update({ where: { id }, data }).then(serialize);
  },

  softDelete(id) {
    return prisma.marketingCampaign.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });
  },

  async promoteDue(now = new Date()) {
    const due = await prisma.marketingCampaign.updateMany({
      where: {
        ...notDeleted,
        status: "scheduled",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      data: { status: "published", publishedAt: now },
    });
    return due.count;
  },

  async expireDue(now = new Date()) {
    const result = await prisma.marketingCampaign.updateMany({
      where: {
        ...notDeleted,
        status: { in: ["published", "scheduled"] },
        endsAt: { lt: now },
      },
      data: { status: "expired" },
    });
    return result.count;
  },

  /**
   * Public active campaigns filtered by page/product.
   */
  async listActive({ pagePath = "/", productSlug = null, audience = null } = {}) {
    const now = new Date();
    const rows = await prisma.marketingCampaign.findMany({
      where: {
        ...notDeleted,
        status: "published",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: includeFull,
      orderBy: { publishedAt: "desc" },
    });

    return rows
      .map(serialize)
      .filter((c) => {
        const scope = c.bannerScope || "entire_website";
        if (scope === "entire_website") return true;
        if (scope === "homepage_only") {
          return pagePath === "/" || pagePath === "/index.html" || pagePath.endsWith("/index.html");
        }
        if (scope === "product_pages") {
          return /\/products\//.test(pagePath) || Boolean(productSlug);
        }
        if (scope === "specific_product") {
          if (!productSlug) return false;
          const ids = (c.products || []).map((p) => p.item?.slug).filter(Boolean);
          return ids.includes(productSlug);
        }
        if (scope === "multiple_pages") {
          // Future: page allow-list; for now require product/category match when configured
          if ((c.products || []).length || (c.categories || []).length || (c.plans || []).length) {
            return true;
          }
          return true;
        }
        return true;
      })
      .filter((c) => {
        const aud = String(c.audience || "all").toLowerCase();
        if (!aud || aud === "all" || aud === "anonymous") return true;
        if (!audience) return true;
        const a = String(audience).toLowerCase();
        if (aud === "new" || aud === "new_visitors") return a === "new";
        if (aud === "returning" || aud === "returning_visitors") return a === "returning";
        return true;
      })
      .filter((c) => {
        if (!productSlug) return true;
        if (!(c.products || []).length && !(c.plans || []).length && !(c.categories || []).length) return true;
        const slugs = (c.products || []).map((p) => p.item?.slug).filter(Boolean);
        if (slugs.length && slugs.includes(productSlug)) return true;
        if ((c.products || []).length && !slugs.includes(productSlug)) return false;
        return true;
      });
  },

  async trackEvent(campaignId, eventType, { pagePath, productSlug, sessionKey, req, metadata } = {}) {
    const counter =
      eventType === "view"
        ? { viewCount: { increment: 1 } }
        : eventType === "banner_click"
          ? { bannerClickCount: { increment: 1 } }
          : eventType === "cta_click"
            ? { ctaClickCount: { increment: 1 } }
            : null;

    await prisma.$transaction(async (tx) => {
      await tx.marketingCampaignEvent.create({
        data: {
          campaignId,
          eventType,
          pagePath: pagePath || null,
          productSlug: productSlug || null,
          sessionKey: sessionKey || null,
          ipHash: req ? hashIp(req.ip) : null,
          metadataJson: metadata || null,
        },
      });
      if (counter) {
        await tx.marketingCampaign.update({ where: { id: campaignId }, data: counter });
      }
    });
  },

  async analytics() {
    const [published, scheduled, paused, expired, top] = await Promise.all([
      prisma.marketingCampaign.count({ where: { ...notDeleted, status: "published" } }),
      prisma.marketingCampaign.count({ where: { ...notDeleted, status: "scheduled" } }),
      prisma.marketingCampaign.count({ where: { ...notDeleted, status: "paused" } }),
      prisma.marketingCampaign.count({ where: { ...notDeleted, status: "expired" } }),
      prisma.marketingCampaign.findMany({
        where: notDeleted,
        orderBy: { viewCount: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          viewCount: true,
          bannerClickCount: true,
          ctaClickCount: true,
          status: true,
        },
      }),
    ]);
    const sums = await prisma.marketingCampaign.aggregate({
      where: notDeleted,
      _sum: { viewCount: true, bannerClickCount: true, ctaClickCount: true },
    });
    const views = sums._sum.viewCount || 0;
    const clicks = (sums._sum.bannerClickCount || 0) + (sums._sum.ctaClickCount || 0);
    return {
      published,
      scheduled,
      paused,
      expired,
      views,
      bannerClicks: sums._sum.bannerClickCount || 0,
      ctaClicks: sums._sum.ctaClickCount || 0,
      conversionRate: views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0,
      top,
    };
  },

  isWindowActive,
};

module.exports = { MarketingCampaignRepository, slugify };
