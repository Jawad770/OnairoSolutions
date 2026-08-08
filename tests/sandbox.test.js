const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { SandboxRepository: sandbox } = require("../server/db/repositories/sandbox");
const { CatalogRepository: catalog } = require("../server/db/repositories/catalog");
const { runSandboxScheduler } = require("../server/sandboxScheduler");

let item;

test.before(async () => {
  await h.start();
  h.createUser("sbx.sales@onairo.test", "sales_manager");

  const software =
    (await catalog.getCategoryBySlug("software")) ||
    (await catalog.createCategory({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));
  const type =
    (await catalog.getTypeBySlug("software")) ||
    (await catalog.createType({ name: "Software", slug: "software", displayOrder: 0, enabled: true }));

  item = await catalog.getItemBySlug("sandbox-test-product", { admin: true });
  if (!item) {
    item = await catalog.createItem({
      name: "Sandbox Test Product",
      slug: "sandbox-test-product",
      shortDescription: "Live short",
      categoryId: software.id,
      productTypeId: type.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
      visibleAi: true,
      seoTitle: "Live SEO",
      ctaLink: "/products/sandbox-test-product",
    });
    await catalog.createPlan({
      itemId: item.id,
      name: "Standard",
      monthlyPrice: 10000,
      currency: "PKR",
      workflowStatus: "published",
      publishedAt: new Date(),
      visibleWebsite: true,
    });
    item = await catalog.getItem(item.id, { admin: true });
  }
});

test.after(async () => {
  await h.stop();
});

test("non–Super Admin cannot open Sandbox", async () => {
  const { client } = await h.login("sbx.sales@onairo.test");
  const res = await client.get("/portal/catalog/sandbox");
  assert.ok(res.status === 302 || res.status === 403);
});

test("Super Admin can open Sandbox and create session", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  let res = await client.get("/portal/catalog/sandbox");
  assert.equal(res.status, 200);
  assert.match(res.text, /Sandbox Environment/i);

  res = await client.get("/portal/catalog/sandbox/new");
  assert.equal(res.status, 200);
  res = await client.post("/portal/catalog/sandbox", {
    name: `Test SBX ${Date.now()}`,
    description: "Isolation test",
  });
  assert.equal(res.status, 302);
  assert.match(String(res.location || ""), /catalog\/sandbox\//);
});

test("sandbox overlays never appear on public API without token", async () => {
  const session = await sandbox.create({ name: `Isolated ${Date.now()}`, description: "x" });
  await sandbox.addCatalogItem(session.id, item.id);
  const change = (await sandbox.get(session.id)).changes[0];
  const after = { ...change.afterJson, shortDescription: "SANDBOX ONLY COPY", name: "Sandbox Renamed Product" };
  await sandbox.updateChange(change.id, after, after.name);

  const client = new h.Client();
  const res = await client.get("/api/catalog/items");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.sandbox, false);
  const found = (body.items || []).find((i) => i.slug === item.slug);
  if (found) {
    assert.notEqual(found.tagline, "SANDBOX ONLY COPY");
    assert.notEqual(found.name, "Sandbox Renamed Product");
  }
});

test("preview token applies overlays on public API", async () => {
  const session = await sandbox.create({ name: `Preview ${Date.now()}` });
  await sandbox.addCatalogItem(session.id, item.id);
  const change = (await sandbox.get(session.id)).changes[0];
  await sandbox.updateChange(
    change.id,
    { ...change.afterJson, shortDescription: "Preview overlay text", seoTitle: "Preview SEO" },
    change.afterJson.name
  );
  const tok = await sandbox.createPreviewToken(session.id, { ttlHours: 2 });

  const client = new h.Client();
  const res = await client.get(`/api/catalog/items?sandbox=${tok.token}`);
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.sandbox, true);
  const found = (body.items || []).find((i) => i.slug === item.slug);
  assert.ok(found);
  assert.equal(found.tagline, "Preview overlay text");
});

test("preview URL requires authentication", async () => {
  const session = await sandbox.create({ name: `Auth preview ${Date.now()}` });
  const tok = await sandbox.createPreviewToken(session.id, { ttlHours: 1 });
  const anon = new h.Client();
  const res = await anon.get(`/preview/${tok.token}`);
  assert.ok(res.status === 302 || res.status === 401 || res.status === 403);
});

test("validation blocks empty sandbox publish; publish updates live", async () => {
  const empty = await sandbox.create({ name: `Empty ${Date.now()}` });
  await assert.rejects(() => sandbox.publishNow(empty.id), /Validation failed|no changes/i);

  const session = await sandbox.create({ name: `Publish ${Date.now()}` });
  await sandbox.addCatalogItem(session.id, item.id);
  const change = (await sandbox.get(session.id)).changes[0];
  await sandbox.updateChange(
    change.id,
    {
      ...change.afterJson,
      shortDescription: "Published from sandbox",
      seoTitle: "SEO from sandbox",
      seoDescription: "Desc",
      ctaLink: "/src/products/",
    },
    change.afterJson.name
  );

  const result = await sandbox.publishNow(session.id);
  assert.ok(result.publishedIds.includes(item.id));
  const live = await catalog.getItem(item.id, { admin: true });
  assert.equal(live.shortDescription, "Published from sandbox");
  assert.equal(live.workflowStatus, "published");
  const refreshed = await sandbox.get(session.id);
  assert.equal(refreshed.status, "published");
});

test("scheduled sandbox job auto-publishes", async () => {
  const session = await sandbox.create({ name: `Sched ${Date.now()}` });
  await sandbox.addCatalogItem(session.id, item.id);
  const change = (await sandbox.get(session.id)).changes[0];
  await sandbox.updateChange(
    change.id,
    {
      ...change.afterJson,
      shortDescription: "Scheduled sandbox publish",
      seoTitle: "Sched SEO",
      seoDescription: "ok",
      ctaLink: "/src/products/",
    },
    change.afterJson.name
  );
  await sandbox.schedulePublish(session.id, {
    scheduledFor: new Date(Date.now() - 60_000),
    timezone: "Asia/Karachi",
  });
  const n = await runSandboxScheduler(new Date());
  assert.ok(n >= 1);
  const refreshed = await sandbox.get(session.id);
  assert.equal(refreshed.status, "published");
  const live = await catalog.getItem(item.id, { admin: true });
  assert.equal(live.shortDescription, "Scheduled sandbox publish");
});
