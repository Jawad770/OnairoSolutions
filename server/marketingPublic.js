/**
 * Public marketing campaigns API.
 */
const rateLimit = require("express-rate-limit");
const { MarketingCampaignRepository: campaigns } = require("./db/repositories/marketingCampaigns");
const { startMarketingCampaignScheduler } = require("./marketingCampaignScheduler");

function publicDto(c) {
  const auto = Boolean(c.autoApplyDiscount);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    campaignType: c.campaignType,
    headline: c.headline,
    subHeading: c.subHeading,
    description: c.description,
    promotionBadge: c.promotionBadge,
    buttonText: c.buttonText,
    buttonLink: c.buttonLink,
    bannerImageUrl: c.bannerImageUrl,
    backgroundImageUrl: c.backgroundImageUrl,
    themeColor: c.themeColor,
    accentColor: c.accentColor,
    icon: c.icon,
    animationStyle: c.animationStyle,
    discountType: c.discountType,
    discountValue: c.discountValue,
    discountCode: auto ? null : c.discountCode,
    autoApplyDiscount: auto,
    campaignId: c.id,
    promotionId: c.promotionId || c.promotion?.id || null,
    linkedPromotionCode: c.promotion?.code || null,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    showCountdown: c.showCountdown,
    bannerPlacement: c.bannerPlacement,
    bannerScope: c.bannerScope,
    dismissible: c.dismissible,
    persistent: c.persistent,
    animated: c.animated,
    audience: c.audience,
    utmSource: c.utmSource,
    utmMedium: c.utmMedium,
    utmCampaign: c.utmCampaign,
    products: (c.products || []).map((p) => ({ slug: p.item?.slug, name: p.item?.name })),
    plans: (c.plans || []).map((p) => ({ id: p.planId, name: p.plan?.name })),
    categories: (c.categories || []).map((p) => ({ id: p.categoryId, slug: p.category?.slug })),
  };
}

function registerMarketingPublicApi(app) {
  startMarketingCampaignScheduler();

  const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/marketing/campaigns/active", limiter, async (req, res) => {
    try {
      const pagePath = String(req.query.page || req.query.path || "/");
      const productSlug = req.query.product || req.query.productSlug || null;
      const rows = await campaigns.listActive({
        pagePath,
        productSlug: productSlug ? String(productSlug) : null,
        audience: req.query.audience ? String(req.query.audience) : null,
      });
      res.json({ ok: true, campaigns: rows.map(publicDto) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[marketing api]", err);
      res.status(500).json({ ok: false, error: "Could not load campaigns" });
    }
  });

  app.post("/api/marketing/campaigns/:slug/event", limiter, async (req, res) => {
    try {
      const row = await campaigns.getBySlug(req.params.slug);
      if (!row) return res.status(404).json({ ok: false, error: "Not found" });
      const eventType = String(req.body?.type || req.body?.eventType || "view");
      if (!["view", "banner_click", "cta_click"].includes(eventType)) {
        return res.status(400).json({ ok: false, error: "Invalid event type" });
      }
      await campaigns.trackEvent(row.id, eventType, {
        pagePath: req.body?.pagePath,
        productSlug: req.body?.productSlug,
        sessionKey: req.body?.sessionKey,
        req,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Could not record event" });
    }
  });
}

module.exports = { registerMarketingPublicApi, publicDto };
