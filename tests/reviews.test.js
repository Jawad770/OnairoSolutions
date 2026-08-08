const test = require("node:test");
const assert = require("node:assert/strict");

const h = require("./helpers");

let submittedId;

test.before(async () => {
  await h.start();
  h.createUser("review.viewer@onairo.test", "viewer");
});

test.after(async () => {
  await h.stop();
});

test("public review submission stays pending and returns a thank-you", async () => {
  const client = new h.Client();
  const response = await client.postJson("/api/reviews", {
    name: "Ayesha Khan",
    review: "The delivery was clear, responsive, and professional.",
  });
  assert.equal(response.status, 201);
  const payload = JSON.parse(response.text);
  assert.equal(payload.ok, true);
  assert.match(payload.message, /Thanks for your review/i);

  const saved = await h.db.prisma.testimonialReview.findFirst({
    where: { name: "Ayesha Khan" },
  });
  assert.ok(saved);
  assert.equal(saved.status, "pending");
  submittedId = saved.id;

  const publicList = await client.get("/api/reviews");
  assert.equal(publicList.status, 200);
  assert.equal(JSON.parse(publicList.text).reviews.length, 0);
});

test("only Super Admin can read the review moderation screen", async () => {
  const viewer = await h.login("review.viewer@onairo.test");
  const denied = await viewer.client.get("/portal/reviews");
  assert.equal(denied.status, 403);

  const root = await h.login("root@onairo.test", "RootPassword123");
  const page = await root.client.get("/portal/reviews");
  assert.equal(page.status, 200);
  assert.match(page.text, /Ayesha Khan/);
  assert.match(page.text, /Approve/);
});

test("approved reviews become public and hidden reviews disappear", async () => {
  const root = await h.login("root@onairo.test", "RootPassword123");
  await root.client.get("/portal/reviews");

  const approved = await root.client.post(`/portal/reviews/${submittedId}/status`, {
    status: "approved",
  });
  assert.equal(approved.status, 302);

  const publicClient = new h.Client();
  const publicList = await publicClient.get("/api/reviews");
  const visible = JSON.parse(publicList.text).reviews;
  assert.equal(visible.length, 1);
  assert.equal(visible[0].name, "Ayesha Khan");

  await root.client.get("/portal/reviews");
  const hidden = await root.client.post(`/portal/reviews/${submittedId}/status`, {
    status: "rejected",
  });
  assert.equal(hidden.status, 302);

  const afterHide = JSON.parse((await publicClient.get("/api/reviews")).text).reviews;
  assert.equal(afterHide.length, 0);
});
