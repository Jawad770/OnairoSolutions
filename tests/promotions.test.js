const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { PromotionRepository: promotions } = require("../server/db/repositories/promotions");
const { CatalogRepository: catalog } = require("../server/db/repositories/catalog");
const { expireDuePromotions } = require("../server/promotionScheduler");

let software;
let type;
let item;
let plan;
let promoId;

test.before(async () => {
  await h.start();
  h.createUser("promo.sales@onairo.test", "sales_manager");

  software = (await catalog.getCategoryBySlug("software")) ||
    (await catalog.createCategory({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));
  type =
    (await catalog.getTypeBySlug("software")) ||
    (await catalog.createType({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));

  item = await catalog.getItemBySlug("promo-test-product", { admin: true });
  if (!item) {
    item = await catalog.createItem({
      name: "Promo Test Product",
      slug: "promo-test-product",
      shortDescription: "For promo tests",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
    });
    plan = await catalog.createPlan({
      itemId: item.id,
      name: "Professional",
      monthlyPrice: 45000,
      currency: "PKR",
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      displayOrder: 0,
    });
  } else {
    plan = (item.plans || []).find((p) => p.name === "Professional");
    if (!plan) {
      plan = await catalog.createPlan({
        itemId: item.id,
        name: "Professional",
        monthlyPrice: 45000,
        currency: "PKR",
        workflowStatus: "published",
        publishedAt: new Date(),
        visibleWebsite: true,
      });
    } else {
      await catalog.updatePlan(plan.id, { monthlyPrice: 45000, workflowStatus: "published" });
    }
  }

  let promo = await promotions.getByCode("WELCOME10");
  if (!promo) {
    promo = await promotions.create(
      {
        name: "Welcome 10%",
        code: "WELCOME10",
        discountType: "percentage",
        discountValue: 10,
        status: "active",
        currency: "PKR",
        usesPerCustomer: 5,
      },
      { productIds: [item.id], planIds: [plan.id] }
    );
  } else {
    await promotions.update(
      promo.id,
      {
        name: promo.name,
        code: "WELCOME10",
        discountType: "percentage",
        discountValue: 10,
        status: "active",
        currency: "PKR",
        usesPerCustomer: 5,
        maxUses: null,
        endsAt: null,
        autoExpire: true,
      },
      { productIds: [item.id], planIds: [plan.id] }
    );
    promo = await promotions.getByCode("WELCOME10");
  }
  promoId = promo.id;
});

test.after(async () => {
  await h.stop();
});

test("non–Super Admin cannot open Promotions", async () => {
  const { client } = await h.login("promo.sales@onairo.test");
  const res = await client.get("/portal/catalog/promotions");
  assert.ok(res.status === 302 || res.status === 403);
});

test("Super Admin can open Promotions dashboard", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const res = await client.get("/portal/catalog/promotions");
  assert.equal(res.status, 200);
  assert.match(res.text, /Promotions|Active/i);
});

test("apply WELCOME10 returns correct final price", async () => {
  const client = new h.Client();
  const res = await client.postJson("/api/catalog/promotions/apply", {
    code: " welcome 10 ",
    productSlug: "promo-test-product",
    planName: "Professional",
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  assert.equal(body.code, "WELCOME10");
  assert.equal(Number(body.original), 45000);
  assert.equal(Number(body.discount), 4500);
  assert.equal(Number(body.final), 40500);
});

test("reject paused / wrong product / min purchase / expired", async () => {
  await promotions.setStatus(promoId, "paused");
  let r = await promotions.apply({
    code: "WELCOME10",
    productSlug: "promo-test-product",
    planName: "Professional",
  });
  assert.equal(r.ok, false);
  await promotions.setStatus(promoId, "active");

  r = await promotions.apply({
    code: "WELCOME10",
    productSlug: "does-not-exist-product",
    planName: "Professional",
  });
  assert.equal(r.ok, false);

  const minPromo = await promotions.create(
    {
      name: "Min purchase",
      code: "MINBIG",
      discountType: "flat",
      discountValue: 1000,
      minPurchaseAmount: 100000,
      status: "active",
      currency: "PKR",
    },
    { productIds: [item.id], planIds: [plan.id] }
  );
  r = await promotions.apply({
    code: "MINBIG",
    productSlug: "promo-test-product",
    planName: "Professional",
  });
  assert.equal(r.ok, false);
  assert.match(r.error || "", /Minimum/i);

  await promotions.update(minPromo.id, {
    name: minPromo.name,
    code: "EXPIRED1",
    discountType: "flat",
    discountValue: 1000,
    status: "active",
    currency: "PKR",
    endsAt: new Date(Date.now() - 60_000),
    autoExpire: true,
    minPurchaseAmount: null,
  });
  // code unique - update code to EXPIRED1 might fail if we need normalize - we set code EXPIRED1
  const expired = await promotions.getByCode("EXPIRED1");
  assert.ok(expired);
  r = await promotions.apply({
    code: "EXPIRED1",
    productSlug: "promo-test-product",
    planName: "Professional",
    amount: 45000,
  });
  assert.equal(r.ok, false);
});

test("redeem increments usedCount and stores CRM metadata", async () => {
  await promotions.setStatus(promoId, "active");
  const before = await promotions.get(promoId);
  const client = new h.Client();
  const res = await client.postJson("/api/catalog/promotions/redeem", {
    code: "WELCOME10",
    productSlug: "promo-test-product",
    planName: "Professional",
    email: "promo.customer@example.com",
    leadId: 999001,
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  assert.equal(body.leadMetadata.discountCode, "WELCOME10");
  assert.equal(Number(body.leadMetadata.finalPrice), 40500);
  const after = await promotions.get(promoId);
  assert.equal(after.usedCount, before.usedCount + 1);
});

test("auto-expire worker marks past endsAt as expired", async () => {
  const p = await promotions.create({
    name: "Auto expire me",
    code: "AUTOEXP1",
    discountType: "percentage",
    discountValue: 5,
    status: "active",
    autoExpire: true,
    endsAt: new Date(Date.now() - 120_000),
    currency: "PKR",
  });
  const n = await expireDuePromotions(new Date());
  assert.ok(n >= 1);
  const updated = await promotions.get(p.id);
  assert.equal(updated.status, "expired");
});

test("reject when max uses reached", async () => {
  const p = await promotions.create({
    name: "One use",
    code: "ONCEONLY",
    discountType: "percentage",
    discountValue: 5,
    status: "active",
    maxUses: 1,
    usedCount: 0,
    currency: "PKR",
  });
  // force usedCount via redeem
  await promotions.redeem({
    code: "ONCEONLY",
    productSlug: "promo-test-product",
    planName: "Professional",
    amount: 45000,
    email: "once@example.com",
  });
  const r = await promotions.apply({
    code: "ONCEONLY",
    productSlug: "promo-test-product",
    planName: "Professional",
    amount: 45000,
  });
  assert.equal(r.ok, false);
  assert.match(r.error || "", /usage limit/i);
  void p;
});
