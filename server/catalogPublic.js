/**
 * Public catalog API — website / AI consumers.
 */
const rateLimit = require("express-rate-limit");
const { CatalogRepository: catalog } = require("./db/repositories/catalog");
const { PromotionRepository: promotions } = require("./db/repositories/promotions");
const { insertLead, persist, nextId, now, state } = require("./db");
const { audit } = require("./audit");
const { startCatalogScheduler } = require("./catalogScheduler");
const { startPromotionScheduler } = require("./promotionScheduler");
const { startSandboxScheduler } = require("./sandboxScheduler");
const { resolveSandboxContext } = require("./sandboxPreview");
const { SandboxRepository: sandbox } = require("./db/repositories/sandbox");

function comparisonFromItem(item) {
  if (!item?.plans?.length) return { columns: [], rows: [] };
  const plans = item.plans;
  const titles = new Map();
  for (const plan of plans) {
    for (const f of plan.features || []) {
      if (!titles.has(f.title)) titles.set(f.title, []);
    }
  }
  const rows = [...titles.keys()].map((title) => {
    const cells = plans.map((plan) => {
      const feature = (plan.features || []).find((f) => f.title === title);
      if (!feature) return { included: false, value: "—" };
      return {
        included: feature.included,
        value: feature.valueText || (feature.included ? "✓" : "—"),
      };
    });
    return { title, cells };
  });
  return {
    columns: plans.map((p) => ({ id: p.id, name: p.name, recommended: p.recommended, badge: p.badge })),
    rows,
  };
}

function toPublicItemDto(item) {
  if (!item) return null;
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.shortDescription || item.fullDescription || "",
    shortDescription: item.shortDescription || "",
    fullDescription: item.fullDescription || "",
    tagline: item.shortDescription || "",
    status: item.comingSoon ? "coming" : item.workflowStatus === "published" ? "live" : "live",
    comingSoon: Boolean(item.comingSoon),
    accent: item.accentColor || "#2563EB",
    cta: {
      text: item.ctaText || "Learn more",
      link: item.ctaLink || null,
    },
    ctaText: item.ctaText,
    ctaLink: item.ctaLink,
    category: item.category?.slug || item.categoryId || null,
    productType: item.productType?.slug || item.productTypeId || null,
    notifyMeEnabled: Boolean(item.notifyMeEnabled),
    expectedLaunchAt: item.expectedLaunchAt || null,
    featured: Boolean(item.featured),
    media: (item.media || []).map((m) => ({
      id: m.id,
      url: m.url,
      alt: m.alt || "",
      kind: m.kind || m.type || "image",
    })),
    plans: (item.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      oneTimePrice: p.oneTimePrice,
      currency: p.currency,
      badge: p.badge,
      popular: Boolean(p.popular),
      recommended: Boolean(p.recommended),
      ctaText: p.ctaText,
      ctaLink: p.ctaLink,
      features: (p.features || []).map((f) => ({
        title: f.title,
        description: f.description || null,
        included: f.included !== false,
        valueText: f.valueText || null,
      })),
    })),
    changelogs: (item.changelogs || []).map((c) => ({
      version: c.version,
      title: c.title,
      body: c.body,
      publishedAt: c.publishedAt || c.createdAt || null,
    })),
    features: (item.plans?.[0]?.features || []).slice(0, 5).map((f) => f.title),
    plansSummary: (item.plans || []).map((p) => p.name).join(" · "),
    href: item.ctaLink || (item.slug === "edutrack" ? "src/products/edutrack.html" : null),
  };
}

function toCardDto(item) {
  const pub = toPublicItemDto(item);
  if (!pub) return null;
  return {
    id: pub.id,
    slug: pub.slug,
    name: pub.name,
    tagline: pub.tagline,
    description: pub.description,
    status: pub.status,
    comingSoon: pub.comingSoon,
    href: pub.href,
    accent: pub.accent,
    features: pub.features,
    cardFeatures: [],
    ctaText: pub.ctaText,
    ctaLink: pub.ctaLink,
    category: pub.category,
    productType: pub.productType,
    notifyMeEnabled: pub.notifyMeEnabled,
    expectedLaunchAt: pub.expectedLaunchAt,
    plansSummary: pub.plansSummary,
  };
}

function registerCatalogPublicApi(app) {
  startCatalogScheduler();
  startPromotionScheduler();
  startSandboxScheduler();

  const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/catalog/categories", limiter, async (_req, res) => {
    try {
      const rows = await catalog.listCategories();
      res.json({ ok: true, categories: rows });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog api]", err);
      res.status(500).json({ ok: false, error: "Could not load categories" });
    }
  });

  app.get("/api/catalog/items", limiter, async (req, res) => {
    try {
      const channel = String(req.query.channel || "website");
      let items = await catalog.listPublicItems(channel, {
        categorySlug: req.query.category || undefined,
        typeSlug: req.query.type || undefined,
      });
      const ctx = await resolveSandboxContext(req);
      let sandboxMode = false;
      if (ctx) {
        items = sandbox.applyItemOverlays(items, ctx.changes);
        sandboxMode = true;
      }
      res.json({
        ok: true,
        sandbox: sandboxMode,
        sandboxSessionId: ctx?.sessionId || null,
        items: items.map(toCardDto),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog api]", err);
      res.status(500).json({ ok: false, error: "Could not load catalog" });
    }
  });

  app.get("/api/catalog/pricing", limiter, async (req, res) => {
    try {
      const { isWebsitePricingVisible } = require("./siteSettings");
      const showPricing = isWebsitePricingVisible();
      if (!showPricing) {
        return res.json({ ok: true, showPricing: false, packages: [] });
      }
      let packages = await catalog.listWebsitePackages();
      const ctx = await resolveSandboxContext(req);
      if (ctx) packages = sandbox.applyItemOverlays(packages, ctx.changes);
      res.json({
        ok: true,
        showPricing: true,
        sandbox: Boolean(ctx),
        packages: packages.map((item) => ({
          slug: item.slug,
          name: item.name,
          tagline: item.shortDescription,
          description: item.fullDescription,
          ctaText: item.ctaText,
          ctaLink: item.ctaLink,
          featured: item.featured,
          accent: item.accentColor,
          plans: (item.plans || []).map((p) => ({
            name: p.name,
            subtitle: p.subtitle,
            monthlyPrice: p.monthlyPrice,
            yearlyPrice: p.yearlyPrice,
            oneTimePrice: p.oneTimePrice,
            currency: p.currency,
            badge: p.badge,
            popular: p.popular,
            recommended: p.recommended,
            features: (p.features || []).map((f) => ({
              title: f.title,
              included: f.included,
              valueText: f.valueText,
            })),
            ctaText: p.ctaText,
            ctaLink: p.ctaLink,
          })),
        })),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog api]", err);
      res.status(500).json({ ok: false, error: "Could not load pricing" });
    }
  });

  app.get("/api/catalog/items/:slug", limiter, async (req, res) => {
    try {
      const channel = String(req.query.channel || "website");
      let item = await catalog.getItemBySlug(req.params.slug, { channel });
      const ctx = await resolveSandboxContext(req);
      if (ctx) {
        const overlaid = sandbox.applyItemOverlays(item ? [item] : [], ctx.changes);
        const match = overlaid.find((i) => i.slug === req.params.slug);
        if (match) item = match;
        else if (!item) {
          // brand-new sandbox-only product
          const created = (ctx.changes || []).find(
            (c) => c.entityType === "catalog_item" && c.changeType === "create" && c.afterJson?.slug === req.params.slug
          );
          if (created) item = sandbox.mergeItem(null, created.afterJson);
        }
      }
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      const { isWebsitePricingVisible } = require("./siteSettings");
      const showPricing = isWebsitePricingVisible();
      const publicItem = toPublicItemDto(item);
      if (!showPricing) {
        publicItem.plans = [];
      }
      res.json({
        ok: true,
        showPricing,
        sandbox: Boolean(ctx),
        item: publicItem,
        comparison: showPricing ? comparisonFromItem(item) : { columns: [], rows: [] },
        card: toCardDto(item),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog api]", err);
      res.status(500).json({ ok: false, error: "Could not load item" });
    }
  });

  app.get("/api/catalog/items/:slug/comparison", limiter, async (req, res) => {
    try {
      const item = await catalog.getItemBySlug(req.params.slug, { channel: "website" });
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, comparison: comparisonFromItem(item) });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Could not load comparison" });
    }
  });

  app.post("/api/catalog/items/:slug/notify", limiter, async (req, res) => {
    try {
      const item = await catalog.getItemBySlug(req.params.slug, { channel: "website" });
      if (!item || !item.notifyMeEnabled) {
        return res.status(404).json({ ok: false, error: "Notify Me is not available for this product." });
      }
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase() || null;
      const whatsapp = String(req.body?.whatsapp || "").trim() || null;
      if (!email && !whatsapp) {
        return res.status(400).json({ ok: false, error: "Provide email or WhatsApp." });
      }
      const discountCode = String(req.body?.discountCode || "").trim() || null;
      let metadataJson = {
        source: "Catalog Notify Me",
        interestedProduct: item.slug,
        campaign: String(req.body?.campaign || "launch") || "launch",
        sourcePage: String(req.body?.sourcePage || "") || null,
      };
      const lead = insertLead({
        sourceType: "catalog_notify",
        name: name || "Notify Me",
        email,
        whatsapp,
        serviceProduct: item.name,
        projectDescription: `Notify Me interest for ${item.name} (${item.slug})`,
        status: "New",
        metadataJson,
      });
      if (discountCode) {
        const redeemed = await promotions.redeem({
          code: discountCode,
          productSlug: item.slug,
          planId: req.body?.planId,
          planName: req.body?.planName,
          email,
          whatsapp,
          leadId: lead.id,
          sourcePage: req.body?.sourcePage,
          req,
        });
        if (redeemed.ok) {
          metadataJson = { ...metadataJson, ...redeemed.leadMetadata };
          lead.metadata_json = metadataJson;
          persist();
          audit(req, "PROMOTION_APPLIED", {
            targetType: "promotion",
            targetId: redeemed.quote.promotionId,
            next: redeemed.leadMetadata,
          });
        }
      }
      state.activities.push({
        id: nextId("activities"),
        lead_id: lead.id,
        user_id: null,
        action_type: "LEAD_CREATED",
        description: `Notify Me interest for ${item.name}`,
        created_at: now(),
      });
      persist();
      await catalog.createNotifyInterest({
        itemId: item.id,
        name: name || null,
        email,
        whatsapp,
        sourcePage: String(req.body?.sourcePage || "").trim() || null,
        campaignSlug: String(req.body?.campaign || "launch").trim() || "launch",
        leadId: Number(lead.id),
        metadataJson: { leadCode: lead.lead_code, ...metadataJson },
      });
      res.json({ ok: true, leadCode: lead.lead_code });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[catalog notify]", err);
      res.status(500).json({ ok: false, error: "Could not save your request." });
    }
  });

  app.post("/api/catalog/promotions/apply", limiter, async (req, res) => {
    try {
      const result = await promotions.apply({
        code: req.body?.code,
        promotionId: req.body?.promotionId,
        productSlug: req.body?.productSlug,
        planId: req.body?.planId,
        planName: req.body?.planName,
        email: req.body?.email,
        whatsapp: req.body?.whatsapp,
        trackAttempt: true,
      });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[promo apply]", err);
      res.status(500).json({ ok: false, error: "Could not apply code." });
    }
  });

  app.post("/api/catalog/promotions/redeem", limiter, async (req, res) => {
    try {
      const result = await promotions.redeem({
        code: req.body?.code || req.body?.discountCode,
        productSlug: req.body?.productSlug,
        planId: req.body?.planId,
        planName: req.body?.planName,
        email: req.body?.email,
        whatsapp: req.body?.whatsapp,
        sourcePage: req.body?.sourcePage,
        req,
      });
      if (!result.ok) return res.status(400).json(result);
      audit(req, "PROMOTION_APPLIED", {
        targetType: "promotion",
        targetId: result.quote.promotionId,
        next: result.leadMetadata,
      });
      res.json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[promo redeem]", err);
      res.status(500).json({ ok: false, error: "Could not redeem code." });
    }
  });
}

module.exports = { registerCatalogPublicApi, comparisonFromItem, toCardDto, toPublicItemDto };
