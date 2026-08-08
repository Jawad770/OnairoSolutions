const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { MarketingCampaignRepository: campaigns } = require("../server/db/repositories/marketingCampaigns");
const { CatalogRepository: catalog } = require("../server/db/repositories/catalog");
const { runMarketingCampaignScheduler } = require("../server/marketingCampaignScheduler");

let item;

test.before(async () => {
  await h.start();
  h.createUser("mkt.sales@onairo.test", "sales_manager");

  const software =
    (await catalog.getCategoryBySlug("software")) ||
    (await catalog.createCategory({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));
  const type =
    (await catalog.getTypeBySlug("software")) ||
    (await catalog.createType({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));

  item = await catalog.getItemBySlug("mkt-test-product", { admin: true });
  if (!item) {
    item = await catalog.createItem({
      name: "Mkt Test Product",
      slug: "mkt-test-product",
      shortDescription: "For marketing campaign tests",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
    });
  }
});

test.after(async () => {
  await h.stop();
});

test("non–Super Admin cannot open Marketing Campaigns", async () => {
  const { client } = await h.login("mkt.sales@onairo.test");
  const res = await client.get("/portal/catalog/marketing");
  assert.ok(res.status === 302 || res.status === 403);
});

test("Super Admin can open Marketing Campaigns dashboard", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const res = await client.get("/portal/catalog/marketing");
  assert.equal(res.status, 200);
  assert.match(res.text, /Marketing Campaigns/i);
});

test("legacy /catalog/campaigns redirects to marketing", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const res = await client.get("/portal/catalog/campaigns");
  assert.equal(res.status, 302);
  assert.match(String(res.location || ""), /catalog\/marketing/);
});

test("scheduled campaign auto-publishes and expires", async () => {
  const past = new Date(Date.now() - 60_000);
  const nearPast = new Date(Date.now() - 30_000);
  const row = await campaigns.create({
    name: "Auto Schedule",
    slug: `auto-sched-${Date.now()}`,
    campaignType: "limited_time",
    status: "scheduled",
    headline: "Ends soon",
    startsAt: past,
    endsAt: nearPast,
    bannerScope: "entire_website",
    bannerPlacement: "top_bar",
  });
  assert.equal(row.status, "scheduled");

  // endsAt already past → expire worker should mark expired (even if still scheduled)
  let result = await runMarketingCampaignScheduler(new Date());
  assert.ok(result.expired >= 1);
  let updated = await campaigns.get(row.id);
  assert.equal(updated.status, "expired");

  const futureEnd = new Date(Date.now() + 3_600_000);
  const sched = await campaigns.create({
    name: "Go Live",
    slug: `go-live-${Date.now()}`,
    campaignType: "launch_offer",
    status: "scheduled",
    headline: "Live now",
    startsAt: past,
    endsAt: futureEnd,
    bannerScope: "entire_website",
  });
  result = await runMarketingCampaignScheduler(new Date());
  assert.ok(result.published >= 1);
  updated = await campaigns.get(sched.id);
  assert.equal(updated.status, "published");
});

test("public active API returns published campaign and hides draft", async () => {
  const live = await campaigns.create(
    {
      name: "Public Banner",
      slug: `public-banner-${Date.now()}`,
      campaignType: "holiday_sale",
      status: "published",
      headline: "Holiday sale",
      promotionBadge: "SALE",
      buttonText: "Shop",
      buttonLink: "/products/",
      themeColor: "#111827",
      accentColor: "#f59e0b",
      discountType: "percentage",
      discountValue: 15,
      autoApplyDiscount: false,
      discountCode: "HOLIDAY15",
      showCountdown: true,
      endsAt: new Date(Date.now() + 86_400_000),
      bannerScope: "entire_website",
      bannerPlacement: "top_bar",
      publishedAt: new Date(),
    },
    { productIds: [item.id] }
  );
  await campaigns.create({
    name: "Draft Hidden",
    slug: `draft-hidden-${Date.now()}`,
    campaignType: "custom",
    status: "draft",
    headline: "Should not show",
    bannerScope: "entire_website",
  });

  const client = new h.Client();
  const res = await client.get("/api/marketing/campaigns/active?page=/");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  const found = (body.campaigns || []).find((c) => c.slug === live.slug);
  assert.ok(found);
  assert.equal(found.headline, "Holiday sale");
  assert.equal(found.discountCode, "HOLIDAY15");
  assert.ok(!(body.campaigns || []).some((c) => /draft-hidden/.test(c.slug)));
});

test("event tracking increments counters", async () => {
  const row = await campaigns.create({
    name: "Track Me",
    slug: `track-me-${Date.now()}`,
    campaignType: "custom",
    status: "published",
    headline: "Track",
    bannerScope: "entire_website",
    publishedAt: new Date(),
  });
  const client = new h.Client();
  let res = await client.postJson(`/api/marketing/campaigns/${row.slug}/event`, {
    type: "view",
    pagePath: "/",
  });
  assert.equal(res.status, 200);
  res = await client.postJson(`/api/marketing/campaigns/${row.slug}/event`, {
    type: "cta_click",
    pagePath: "/",
  });
  assert.equal(res.status, 200);
  const updated = await campaigns.get(row.id);
  assert.ok(updated.viewCount >= 1);
  assert.ok(updated.ctaClickCount >= 1);
});
