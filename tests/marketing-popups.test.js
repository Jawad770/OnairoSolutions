const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const { MarketingPopupRepository: popups } = require("../server/db/repositories/marketingPopups");
const { publicDto } = require("../server/popupPublic");

test.before(async () => {
  await h.start();
  h.createUser("popup.sales@onairo.test", "sales_manager");
});

test.after(async () => {
  await h.stop();
});

test("unauthorized users cannot open Marketing Popups", async () => {
  const { client } = await h.login("popup.sales@onairo.test");
  const res = await client.get("/portal/marketing/popups");
  assert.ok(res.status === 302 || res.status === 403);
});

test("Super Admin can open Marketing Popups", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const res = await client.get("/portal/marketing/popups");
  assert.equal(res.status, 200);
  assert.match(res.text, /Promotional Popups/i);
});

test("public active popup API returns ok payload", async () => {
  const client = new h.Client();
  const res = await client.get("/api/public/popups/active?page=/");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.ok, true);
  assert.ok("popup" in body);
  assert.ok(Array.isArray(body.popups));
});

test("enabled in-window popup appears on homepage API only", async () => {
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 3_600_000);
  const row = await popups.create({
    name: `API Popup ${Date.now()}`,
    title: "Happy 14th August",
    description: "Celebrate",
    imageUrl: "/uploads/popups/independence-day-2026.png",
    buttonText: "Contact",
    buttonUrl: "/pages/contact.html",
    enabled: true,
    startAt: past,
    endAt: future,
    displayFrequency: "once_per_session",
    delayMs: 500,
    targetPages: "homepage_only",
    priority: 5,
  });

  const client = new h.Client();
  const home = await client.get("/api/public/popups/active?page=/");
  assert.equal(home.status, 200);
  const homeBody = JSON.parse(home.text);
  assert.equal(homeBody.ok, true);
  assert.ok(homeBody.popup);
  assert.equal(homeBody.popup.id, row.id);
  assert.equal(homeBody.popup.title, "Happy 14th August");
  assert.ok(!("enabled" in homeBody.popup));
  assert.ok(!("deletedAt" in homeBody.popup));
  assert.ok(!("name" in homeBody.popup));

  const about = await client.get("/api/public/popups/active?page=/pages/about.html");
  const aboutBody = JSON.parse(about.text);
  assert.equal(aboutBody.popup, null);

  await popups.setEnabled(row.id, false);
  const disabled = await client.get("/api/public/popups/active?page=/");
  const disabledBody = JSON.parse(disabled.text);
  assert.equal(disabledBody.popup, null);
});

test("expired and future popups are excluded", async () => {
  const expired = await popups.create({
    name: `Expired ${Date.now()}`,
    enabled: true,
    startAt: new Date(Date.now() - 86_400_000),
    endAt: new Date(Date.now() - 3_600_000),
    targetPages: "entire_website",
    priority: 1,
  });
  const future = await popups.create({
    name: `Future ${Date.now()}`,
    enabled: true,
    startAt: new Date(Date.now() + 86_400_000),
    endAt: new Date(Date.now() + 172_800_000),
    targetPages: "entire_website",
    priority: 1,
  });

  const client = new h.Client();
  const res = await client.get("/api/public/popups/active?page=/pages/contact.html");
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  const ids = (body.popups || []).map((p) => p.id);
  assert.ok(!ids.includes(expired.id));
  assert.ok(!ids.includes(future.id));
});

test("publicDto strips admin fields", () => {
  const dto = publicDto({
    id: "x",
    name: "secret-name",
    title: "T",
    description: "D",
    imageUrl: "/uploads/popups/a.png",
    buttonText: "Go",
    buttonUrl: "/pages/contact.html",
    enabled: true,
    startAt: new Date(),
    endAt: new Date(),
    displayFrequency: "once_per_day",
    delayMs: 1000,
    targetPages: "homepage_only",
    priority: 10,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(dto.title, "T");
  assert.equal(dto.displayFrequency, "once_per_day");
  assert.ok(!("name" in dto));
  assert.ok(!("enabled" in dto));
  assert.ok(!("startAt" in dto));
  assert.ok(!("deletedAt" in dto));
});

test("admin can open create preview and manage popup lifecycle", async () => {
  const { client } = await h.login("root@onairo.test", "RootPassword123");
  const createPage = await client.get("/portal/marketing/popups/new");
  assert.equal(createPage.status, 200);

  const created = await popups.create({
    name: `CRUD ${Date.now()}`,
    title: "CRUD Title",
    enabled: false,
    targetPages: "entire_website",
    displayFrequency: "always",
    priority: 50,
  });

  const open = await client.get(`/portal/marketing/popups/${created.id}`);
  assert.equal(open.status, 200);
  assert.match(open.text, /CRUD Title/);

  const preview = await client.get(`/portal/marketing/popups/${created.id}/preview`);
  assert.equal(preview.status, 200);
  assert.match(preview.text, /Admin preview only/i);

  await popups.setEnabled(created.id, true);
  const anon = new h.Client();
  const active = await anon.get("/api/public/popups/active?page=/pages/about.html");
  const activeBody = JSON.parse(active.text);
  assert.equal(activeBody.popup?.id, created.id);

  await popups.softDelete(created.id);
  const gone = await anon.get("/api/public/popups/active?page=/pages/about.html");
  const goneBody = JSON.parse(gone.text);
  assert.notEqual(goneBody.popup?.id, created.id);
});

test("health portal login and showcase still work", async () => {
  const client = new h.Client();
  const health = await client.get("/health");
  assert.equal(health.status, 200);
  const healthBody = JSON.parse(health.text);
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.database, true);

  const login = await client.get("/portal/login");
  assert.equal(login.status, 200);

  const showcase = await client.get("/showcase/carshowroom");
  assert.ok(showcase.status === 200 || showcase.status === 404);
});
