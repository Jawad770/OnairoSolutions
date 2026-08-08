const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { CatalogRepository: catalog } = require("../server/db/repositories/catalog");
const { promoteDue } = require("../server/catalogScheduler");

let superAdmin;
let salesManager;

test.before(async () => {
  await h.start();
  superAdmin = h.db.state.users.find((u) => u.email === "root@onairo.test");
  salesManager = h.createUser("catalog.sales@onairo.test", "sales_manager");

  // Ensure taxonomy exists for tests
  let software = await catalog.getCategoryBySlug("software");
  if (!software) {
    software = await catalog.createCategory({
      name: "Software",
      slug: "software",
      displayOrder: 0,
      enabled: true,
    });
  }
  let website = await catalog.getCategoryBySlug("website-services");
  if (!website) {
    website = await catalog.createCategory({
      name: "Website Services",
      slug: "website-services",
      displayOrder: 1,
      enabled: true,
    });
  }
  let type = await catalog.getTypeBySlug("software");
  if (!type) {
    type = await catalog.createType({ name: "Software", slug: "software", displayOrder: 0, enabled: true });
  }
  let serviceType = await catalog.getTypeBySlug("service");
  if (!serviceType) {
    serviceType = await catalog.createType({ name: "Service", slug: "service", displayOrder: 1, enabled: true });
  }

  // Draft item — must not appear on public API
  let draft = await catalog.getItemBySlug("test-draft-product", { admin: true });
  if (!draft) {
    draft = await catalog.createItem({
      name: "Draft Only Product",
      slug: "test-draft-product",
      shortDescription: "Should stay hidden",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "draft",
      visibleWebsite: true,
      visibleAi: true,
    });
  } else {
    await catalog.updateItem(draft.id, { workflowStatus: "draft", deletedAt: null });
  }

  // Published software item
  let live = await catalog.getItemBySlug("test-live-product", { admin: true });
  if (!live) {
    live = await catalog.createItem({
      name: "Live Catalog Product",
      slug: "test-live-product",
      shortDescription: "Public product",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
      comingSoon: false,
      ctaLink: "src/products/edutrack.html",
    });
  } else {
    await catalog.updateItem(live.id, {
      workflowStatus: "published",
      visibleWebsite: true,
      visibleAi: true,
      deletedAt: null,
    });
  }

  // Website package for pricing API
  let pkg = await catalog.getItemBySlug("website-test-starter", { admin: true });
  if (!pkg) {
    pkg = await catalog.createItem({
      name: "Test Starter",
      slug: "website-test-starter",
      shortDescription: "Test package",
      categoryId: website.id,
      productTypeId: serviceType.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
    });
    await catalog.createPlan({
      itemId: pkg.id,
      name: "Starter",
      oneTimePrice: 150,
      currency: "USD",
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      displayOrder: 0,
    });
  }

  // Coming soon with notify
  let soon = await catalog.getItemBySlug("test-coming-soon", { admin: true });
  if (!soon) {
    soon = await catalog.createItem({
      name: "Coming Soon Track",
      slug: "test-coming-soon",
      shortDescription: "Notify me",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      comingSoon: true,
      notifyMeEnabled: true,
      visibleComingSoon: true,
      visibleWebsite: true,
      visibleAi: true,
    });
  } else {
    await catalog.updateItem(soon.id, {
      comingSoon: true,
      notifyMeEnabled: true,
      visibleComingSoon: true,
      workflowStatus: "published",
      deletedAt: null,
    });
  }

  // AI-only item
  let aiOnly = await catalog.getItemBySlug("test-ai-only", { admin: true });
  if (!aiOnly) {
    await catalog.createItem({
      name: "AI Only Product",
      slug: "test-ai-only",
      shortDescription: "Hidden from website",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: false,
      visibleAi: true,
    });
  } else {
    await catalog.updateItem(aiOnly.id, {
      visibleWebsite: false,
      visibleAi: true,
      workflowStatus: "published",
      deletedAt: null,
    });
  }
});

test.after(async () => {
  await h.stop();
});

test("non–Super Admin cannot open Catalog Manager", async () => {
  const { client } = await h.login("catalog.sales@onairo.test");
  const res = await client.get("/portal/catalog");
  assert.ok(res.status === 302 || res.status === 403);
  if (res.status === 302) {
    assert.match(String(res.location || ""), /portal|login|error/i);
  }
});

test("Super Admin can open Catalog Manager", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const res = await client.get("/portal/catalog");
  assert.equal(res.status, 200);
  assert.match(res.text, /Catalog/i);
});

test("public API hides draft items", async () => {
  const client = new h.Client();
  const res = await client.get("/api/catalog/items");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  const slugs = (body.items || []).map((i) => i.slug);
  assert.ok(!slugs.includes("test-draft-product"));
  assert.ok(slugs.includes("test-live-product"));
});

test("public pricing returns website packages", async () => {
  const client = new h.Client();
  const res = await client.get("/api/catalog/pricing");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.packages));
  assert.ok(body.packages.some((p) => p.slug === "website-test-starter"));
});

test("visibility: AI-only product not on website channel", async () => {
  const client = new h.Client();
  const web = JSON.parse((await client.get("/api/catalog/items")).text);
  const ai = JSON.parse((await client.get("/api/catalog/items?channel=ai")).text);
  const webSlugs = (web.items || []).map((i) => i.slug);
  const aiSlugs = (ai.items || []).map((i) => i.slug);
  assert.ok(!webSlugs.includes("test-ai-only"));
  assert.ok(aiSlugs.includes("test-ai-only"));
});

test("Notify Me creates CRM lead and interest row", async () => {
  const client = new h.Client();
  const before = h.db.state.leads.length;
  const res = await client.postJson("/api/catalog/items/test-coming-soon/notify", {
    name: "Notify Tester",
    email: "notify.tester@example.com",
    campaign: "launch",
    sourcePage: "/products",
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  assert.ok(body.leadCode);
  assert.equal(h.db.state.leads.length, before + 1);
  const lead = h.db.state.leads[h.db.state.leads.length - 1];
  assert.equal(lead.source_type, "catalog_notify");
  assert.equal(lead.email, "notify.tester@example.com");
  const interests = await catalog.listNotifyInterests();
  assert.ok(interests.some((i) => i.email === "notify.tester@example.com"));
});

test("scheduled publish promotes due draft", async () => {
  const software = await catalog.getCategoryBySlug("software");
  const type = await catalog.getTypeBySlug("software");
  let item = await catalog.getItemBySlug("test-scheduled", { admin: true });
  const past = new Date(Date.now() - 60_000);
  if (!item) {
    item = await catalog.createItem({
      name: "Scheduled Product",
      slug: "test-scheduled",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "draft",
      publishAt: past,
      visibleWebsite: true,
      visibleAi: true,
    });
  } else {
    await catalog.updateItem(item.id, {
      workflowStatus: "draft",
      publishAt: past,
      deletedAt: null,
    });
  }
  const n = await promoteDue(new Date());
  assert.ok(n >= 1);
  const updated = await catalog.getItem(item.id, { admin: true });
  assert.equal(updated.workflowStatus, "published");
  assert.equal(updated.publishAt, null);

  const client = new h.Client();
  const body = JSON.parse((await client.get("/api/catalog/items")).text);
  assert.ok((body.items || []).some((i) => i.slug === "test-scheduled"));
});

test("price change appears on public item endpoint", async () => {
  const live = await catalog.getItemBySlug("test-live-product", { admin: true });
  assert.ok(live);
  let plan = (live.plans || []).find((p) => p.name === "Pro");
  if (!plan) {
    plan = await catalog.createPlan({
      itemId: live.id,
      name: "Pro",
      monthlyPrice: 999,
      currency: "PKR",
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      displayOrder: 0,
    });
  }
  await catalog.updatePlan(plan.id, { monthlyPrice: 12345, workflowStatus: "published" });
  const client = new h.Client();
  const res = await client.get("/api/catalog/items/test-live-product");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  const pro = (body.item.plans || []).find((p) => p.name === "Pro");
  assert.ok(pro);
  assert.equal(Number(pro.monthlyPrice), 12345);
});
