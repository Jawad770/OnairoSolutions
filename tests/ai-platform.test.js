const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const ai = require(path.join(__dirname, "..", "server", "ai", "register.js"));

describe("Onairo AI knowledge search", () => {
  it("loads company knowledge", () => {
    const kb = ai.reloadKnowledge();
    assert.equal(kb.company.brand, "Onairo Solutions");
    assert.ok(Array.isArray(kb.services.services));
    assert.ok(kb.pricing.websitePackages.length >= 3);
  });

  it("finds website pricing", () => {
    const result = ai.searchPricing("website starter");
    const blob = JSON.stringify(result);
    assert.match(blob, /150|Starter/i);
  });

  it("finds EduTrack product", () => {
    const result = ai.searchProducts("EduTrack school");
    assert.ok(result.products.some((p) => /edutrack/i.test(p.id || p.name)));
  });

  it("finds dental demo in portfolio", () => {
    const result = ai.searchPortfolio("dental clinic");
    assert.ok(result.demos.some((d) => /dental/i.test(d.industry || d.id)));
  });

  it("scores token matches", () => {
    assert.ok(ai.knowledgeTest.scoreMatch("dental clinic website", "dental") > 0);
    assert.equal(ai.knowledgeTest.scoreMatch("gym", "restaurant"), 0);
  });
});

describe("Onairo AI lead validation", () => {
  it("requires name and contact method", () => {
    const bad = ai.validateLeadInput({ name: "", summary: "x" });
    assert.equal(bad.ok, false);

    const noContact = ai.validateLeadInput({ name: "Ali", summary: "Needs website" });
    assert.equal(noContact.ok, false);
  });

  it("accepts valid lead with WhatsApp", () => {
    const ok = ai.validateLeadInput({
      name: "Ali Khan",
      businessName: "Smile Dental",
      whatsapp: "03272340505",
      summary: "Visitor owns a dental clinic.\nNeeds a modern website.",
      intentScore: 80,
      confidenceScore: 70,
      conversationId: "test",
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.data.whatsapp, "923272340505");
    assert.equal(ok.data.intentScore, 80);
  });

  it("accepts email-only contact", () => {
    const ok = ai.validateLeadInput({
      name: "Sara",
      email: "sara@example.com",
      summary: "Interested in EduTrack trial.",
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.data.email, "sara@example.com");
  });

  it("normalizes Pakistani mobile numbers", () => {
    assert.equal(ai.normalizeWhatsapp("0313-7863988"), "923272340505");
    assert.equal(ai.normalizeWhatsapp("+92 327 2340505"), "923272340505");
  });
});

describe("Onairo AI retention helper", () => {
  it("treats null expiresAt as permanent", () => {
    assert.equal(ai.isExpired(null), false);
  });

  it("detects past expiry", () => {
    const past = new Date(Date.now() - 60_000);
    assert.equal(ai.isExpired(past), true);
    const future = new Date(Date.now() + 60_000);
    assert.equal(ai.isExpired(future), false);
  });
});

describe("Onairo AI provider resolution", () => {
  it("defaults to gemini and requires GEMINI key", () => {
    const r = ai.resolveAiProvider({
      enabled: true,
      provider: "gemini",
      geminiApiKey: "",
      geminiModel: "gemini-3.6-flash",
    });
    assert.equal(r.name, "gemini");
    assert.equal(r.ready, false);
  });

  it("marks gemini ready when key is set", () => {
    const r = ai.resolveAiProvider({
      enabled: true,
      provider: "gemini",
      geminiApiKey: "test-key",
      geminiModel: "gemini-3.6-flash",
    });
    assert.equal(r.ready, true);
    assert.equal(r.model, "gemini-3.6-flash");
  });

  it("switches to openai when AI_PROVIDER=openai", () => {
    const r = ai.resolveAiProvider({
      enabled: true,
      provider: "openai",
      openaiApiKey: "sk-test",
      openaiModel: "gpt-4o-mini",
      geminiApiKey: "other",
    });
    assert.equal(r.name, "openai");
    assert.equal(r.apiKey, "sk-test");
    assert.equal(r.ready, true);
  });
});
