const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

test.before(async () => {
  await h.start();
});

test.after(async () => {
  await h.stop();
});

test("footer newsletter signup creates one CRM lead", async () => {
  const email = `newsletter-${Date.now()}@example.com`;
  const client = new h.Client();

  let res = await client.postJson("/api/newsletter/subscribe", {
    email,
    source: "footer",
  });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.text).ok, true);

  let leads = h.db.state.leads.filter(
    (lead) => lead.source_type === "newsletter" && lead.email === email
  );
  assert.equal(leads.length, 1);
  assert.equal(leads[0].preferred_contact_method, "Email");
  assert.equal(leads[0].metadata_json.subscriptionSource, "footer");

  res = await client.postJson("/api/newsletter/subscribe", {
    email: email.toUpperCase(),
    source: "footer",
  });
  assert.equal(res.status, 200);

  leads = h.db.state.leads.filter(
    (lead) => lead.source_type === "newsletter" && lead.email === email
  );
  assert.equal(leads.length, 1);
});
