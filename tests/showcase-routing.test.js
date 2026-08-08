/**
 * HTTP smoke tests for production showcase routing.
 * Uses the shared test harness (throwaway DB) — no redesign of portal tests.
 */
const path = require("path");
const fs = require("fs");

const demosDir = path.join(__dirname, "..", "public", "demos");
process.env.SHOWCASE_DIRECTORY = demosDir;
process.env.DEMO_DIRECTORY = demosDir;

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const helpers = require("./helpers");

describe("showcase routing", () => {
  let baseUrl;

  before(async () => {
    assert.ok(fs.existsSync(path.join(demosDir, "carshowroom.html")), "public/demos/carshowroom.html missing");
    assert.ok(fs.existsSync(path.join(demosDir, "restaurant.html")), "public/demos/restaurant.html missing");
    assert.ok(fs.existsSync(path.join(demosDir, "demo-globals.js")), "public/demos/demo-globals.js missing");
    baseUrl = await helpers.start();
  });

  after(async () => {
    await helpers.stop();
  });

  async function probe(urlPath) {
    const res = await fetch(`${baseUrl}${urlPath}`, { redirect: "manual" });
    return { status: res.status, location: res.headers.get("location"), res };
  }

  it("GET /showcase/carshowroom → 200", async () => {
    const { status, res } = await probe("/showcase/carshowroom");
    assert.equal(status, 200);
    const text = await res.text();
    assert.match(text, /DriveZone|carshowroom|demo-globals/i);
  });

  it("GET /showcase/restaurant → 200", async () => {
    const { status } = await probe("/showcase/restaurant");
    assert.equal(status, 200);
  });

  it("GET /showcase/demo-globals.js → 200", async () => {
    const { status, res } = await probe("/showcase/demo-globals.js");
    assert.equal(status, 200);
    const text = await res.text();
    assert.match(text, /DemoGlobals/);
  });

  it("GET /showcase/missing-demo → 404", async () => {
    const { status } = await probe("/showcase/missing-demo");
    assert.equal(status, 404);
  });

  it("GET /demo/carshowroom → 301 → /showcase/carshowroom", async () => {
    const { status, location } = await probe("/demo/carshowroom");
    assert.equal(status, 301);
    assert.equal(location, "/showcase/carshowroom");
  });

  it("GET /src/portfolio/demos/carshowroom.html → 301 → /showcase/carshowroom", async () => {
    const { status, location } = await probe("/src/portfolio/demos/carshowroom.html");
    assert.equal(status, 301);
    assert.equal(location, "/showcase/carshowroom");
  });

  it("GET /server/main.js → 404", async () => {
    const { status } = await probe("/server/main.js");
    assert.equal(status, 404);
  });

  it("GET /package.json → 404", async () => {
    const { status } = await probe("/package.json");
    assert.equal(status, 404);
  });
});
