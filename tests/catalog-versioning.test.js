const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { CatalogRepository: catalog } = require("../server/db/repositories/catalog");
const versioning = require("../server/catalogVersioning");
const { prisma } = require("../server/db");

let software;
let type;
let itemId;

test.before(async () => {
  await h.start();
  h.createUser("version.sales@onairo.test", "sales_manager");

  software = await catalog.getCategoryBySlug("software");
  if (!software) {
    software = await catalog.createCategory({
      name: "Software",
      slug: "software",
      displayOrder: 0,
      enabled: true,
    });
  }
  type = await catalog.getTypeBySlug("software");
  if (!type) {
    type = await catalog.createType({ name: "Software", slug: "software", displayOrder: 0, enabled: true });
  }

  let item = await catalog.getItemBySlug("version-test-product", { admin: true });
  if (!item) {
    item = await catalog.createItem({
      name: "Version Test Product",
      slug: "version-test-product",
      shortDescription: "Baseline",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
    });
    await catalog.createPlan({
      itemId: item.id,
      name: "Professional",
      monthlyPrice: 35000,
      currency: "PKR",
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      displayOrder: 0,
    });
  }
  itemId = item.id;
  await versioning.ensureBaseline(itemId, { summaryHint: "Initial Release" });
});

test.after(async () => {
  await h.stop();
});

test("non–Super Admin cannot open version history", async () => {
  const { client } = await h.login("version.sales@onairo.test");
  const res = await client.get(`/portal/catalog/${itemId}/versions`);
  assert.ok(res.status === 302 || res.status === 403);
});

test("price change creates a new revision with change rows", async () => {
  const before = await versioning.listRevisions(itemId);
  const beforeCount = before.length;
  const current = before.find((r) => r.status === "current") || before[0];
  assert.ok(current);

  const live = await catalog.getItem(itemId, { admin: true });
  const plan = (live.plans || []).find((p) => p.name === "Professional");
  assert.ok(plan);
  await catalog.updatePlan(plan.id, { monthlyPrice: 40000, workflowStatus: "published" });
  const rev = await versioning.createRevision({ itemId, summaryHint: null });
  assert.ok(rev);
  assert.equal(rev.versionNumber, beforeCount + 1);
  assert.match(rev.summary, /Price Updated|Professional/i);

  const withChanges = await versioning.getRevision(itemId, rev.versionNumber);
  const priceChange = (withChanges.changes || []).find(
    (c) => c.field === "monthlyPrice" && c.changeType === "modified"
  );
  assert.ok(priceChange);
  assert.equal(Number(priceChange.beforeJson), 35000);
  assert.equal(Number(priceChange.afterJson), 40000);

  const old = await versioning.getRevision(itemId, current.versionNumber);
  assert.ok(old);
  assert.notEqual(old.status, "current");
});

test("no-op save does not create a revision", async () => {
  const before = await versioning.listRevisions(itemId);
  const again = await versioning.createRevision({ itemId });
  const after = await versioning.listRevisions(itemId);
  assert.equal(after.length, before.length);
  assert.equal(again?.versionNumber, before[0]?.versionNumber);
});

test("restore previous version publishes live graph and creates new revision", async () => {
  const revisions = await versioning.listRevisions(itemId);
  const v1 = [...revisions].sort((a, b) => a.versionNumber - b.versionNumber)[0];
  assert.ok(v1);

  const restored = await versioning.restoreVersion(itemId, v1.versionNumber, {
    reason: "Test restore",
  });
  assert.ok(restored);
  assert.equal(restored.restoredFromVersion, v1.versionNumber);
  assert.match(restored.summary, /Restored Version/i);

  const live = await catalog.getItem(itemId, { admin: true });
  assert.equal(live.workflowStatus, "published");
  const plan = (live.plans || []).find((p) => p.name === "Professional");
  assert.ok(plan);
  const snapPlan = (v1.snapshotJson.plans || []).find((p) => p.name === "Professional");
  assert.equal(Number(plan.monthlyPrice), Number(snapPlan.monthlyPrice));

  const client = new h.Client();
  const res = await client.get("/api/catalog/items/version-test-product");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  const publicPlan = (body.item.plans || []).find((p) => p.name === "Professional");
  assert.ok(publicPlan);
  assert.equal(Number(publicPlan.monthlyPrice), Number(snapPlan.monthlyPrice));
});

test("Downloads ProductVersion model remains separate", async () => {
  const count = await prisma.productVersion.count();
  assert.equal(typeof count, "number");
  const revCount = await prisma.catalogRevision.count({ where: { itemId } });
  assert.ok(revCount >= 1);
});
