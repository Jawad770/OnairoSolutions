import fs from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(__dirname, "..", "..", "knowledge");

export interface KnowledgeBundle {
  company: Record<string, unknown>;
  pricing: Record<string, unknown>;
  services: { services: Array<Record<string, unknown>> };
  products: { products: Array<Record<string, unknown>> };
  portfolio: { demos: Array<Record<string, unknown>>; note?: string };
  faqs: { faqs: Array<{ id: string; q: string; a: string }> };
}

let cache: KnowledgeBundle | null = null;
/** Live catalog overlay — preferred over static JSON when present. */
let catalogProducts: { products: Array<Record<string, unknown>> } | null = null;
let catalogPricing: Record<string, unknown> | null = null;

function readJson<T>(filename: string): T {
  const full = path.join(KNOWLEDGE_DIR, filename);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function loadKnowledge(): KnowledgeBundle {
  if (cache) return cache;
  cache = {
    company: readJson("company.json"),
    pricing: readJson("pricing.json"),
    services: readJson("services.json"),
    products: readJson("products.json"),
    portfolio: readJson("portfolio.json"),
    faqs: readJson("faqs.json"),
  };
  return cache;
}

export function reloadKnowledge(): KnowledgeBundle {
  cache = null;
  return loadKnowledge();
}

function scoreMatch(text: string, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const hay = text.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (!tokens.length) return hay.includes(q) ? 1 : 0;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

function stringify(obj: unknown): string {
  return JSON.stringify(obj);
}

function formatPlanPrice(_plan: {
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  oneTimePrice?: number | null;
  currency?: string | null;
}): string {
  /* Public AI must never expose amounts — plans are described by name/features only. */
  return "Quote on request";
}

function stripPricesDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripPricesDeep(v)) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      /price|fromusd|approxpkr|monthlyprice|yearlyprice|onetimeprice|amount|cost|fee/i.test(k)
    ) {
      continue;
    }
    out[k] = stripPricesDeep(v);
  }
  return out as T;
}

/**
 * Prefer live Catalog Manager data for products + website / EduTrack pricing.
 * Falls back silently to JSON knowledge files when DB is empty or unavailable.
 */
export async function syncCatalogKnowledge(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CatalogRepository } = require("../../db/repositories/catalog") as {
      CatalogRepository: {
        listPublicItems: (channel: string, opts?: object) => Promise<Array<Record<string, unknown>>>;
        listWebsitePackages: () => Promise<Array<Record<string, unknown>>>;
        getItemBySlug: (slug: string, opts?: object) => Promise<Record<string, unknown> | null>;
      };
    };
    const [aiItems, packages, edutrack] = await Promise.all([
      CatalogRepository.listPublicItems("ai"),
      CatalogRepository.listWebsitePackages(),
      CatalogRepository.getItemBySlug("edutrack", { channel: "ai" }),
    ]);

    if (aiItems?.length) {
      catalogProducts = {
        products: aiItems.map((item) => {
          const plans = (item.plans as Array<Record<string, unknown>>) || [];
          const features = plans[0]
            ? ((plans[0].features as Array<{ title?: string }>) || []).map((f) => f.title).filter(Boolean)
            : [];
          return {
            id: item.slug,
            name: item.name,
            status: item.comingSoon ? "coming" : "live",
            tagline: item.shortDescription || "",
            description: item.fullDescription || item.shortDescription || "",
            features,
            url: item.ctaLink || null,
            pricingNote: item.comingSoon
              ? "Coming soon"
              : plans.map((p) => String(p.name || "")).filter(Boolean).join(", ") ||
                "Plans available — quote on request",
          };
        }),
      };
    }

    const staticPricing = loadKnowledge().pricing as {
      disclaimer?: string;
      customSoftware?: unknown;
      edutrackTrial?: string;
    };

    const websitePackages = (packages || []).map((pkg) => {
      const plan = ((pkg.plans as Array<Record<string, unknown>>) || [])[0] || {};
      return {
        id: String(pkg.slug || "").replace(/^website-/, ""),
        name: pkg.name,
        tagline: pkg.shortDescription || "",
        recommended: Boolean(plan.recommended || plan.popular || pkg.featured),
        includes: ((plan.features as Array<{ title?: string; included?: boolean }>) || [])
          .filter((f) => f.included !== false)
          .map((f) => f.title)
          .filter(Boolean),
      };
    });

    const edutrackPlans = edutrack
      ? (((edutrack.plans as Array<Record<string, unknown>>) || []).map((p) => ({
          id: String(p.name || "")
            .toLowerCase()
            .replace(/\s+/g, "-"),
          name: p.name,
          recommended: Boolean(p.recommended),
          notes: p.subtitle || "",
        })) as Array<Record<string, unknown>>)
      : [];

    if (websitePackages.length || edutrackPlans.length) {
      catalogPricing = {
        disclaimer:
          staticPricing.disclaimer ||
          "Never disclose numeric prices. Describe plans only; commercial terms are quote-only.",
        websitePackages: websitePackages.length
          ? websitePackages
          : (loadKnowledge().pricing as { websitePackages?: unknown[] }).websitePackages,
        edutrackPlans: edutrackPlans.length
          ? edutrackPlans
          : (loadKnowledge().pricing as { edutrackPlans?: unknown[] }).edutrackPlans,
        edutrackTrial: staticPricing.edutrackTrial || "14-day free trial available",
        customSoftware: staticPricing.customSoftware,
        source: "catalog",
      };
    }
    return Boolean(catalogProducts || catalogPricing);
  } catch {
    return false;
  }
}

function activePricing(): Record<string, unknown> {
  return catalogPricing || (loadKnowledge().pricing as Record<string, unknown>);
}

function activeProducts(): { products: Array<Record<string, unknown>> } {
  return catalogProducts || loadKnowledge().products;
}

export function searchPricing(query = ""): unknown {
  const pricing = stripPricesDeep(
    activePricing() as {
      websitePackages?: unknown[];
      edutrackPlans?: unknown[];
      customSoftware?: unknown;
      disclaimer?: string;
    }
  );
  if (!query.trim()) return pricing;
  const items: unknown[] = [];
  for (const pkg of pricing.websitePackages || []) {
    if (scoreMatch(stringify(pkg), query) > 0.2) items.push({ type: "website_package", ...((pkg as object) || {}) });
  }
  for (const plan of pricing.edutrackPlans || []) {
    if (scoreMatch(stringify(plan), query) > 0.2) items.push({ type: "edutrack_plan", ...((plan as object) || {}) });
  }
  if (/custom|software|bespoke|quote/i.test(query)) {
    items.push({ type: "custom_software", ...(pricing.customSoftware as object) });
  }
  return {
    disclaimer:
      pricing.disclaimer ||
      "Never disclose numeric prices. Describe plans only; invite Request Quote or WhatsApp for commercial terms.",
    results: items.length ? items : pricing,
  };
}

export function searchServices(query = ""): unknown {
  const kb = loadKnowledge();
  const list = kb.services.services || [];
  if (!query.trim()) return { services: list };
  const ranked = list
    .map((s) => ({ score: scoreMatch(stringify(s), query), item: s }))
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
  return { services: ranked.length ? ranked : list.slice(0, 5) };
}

export function searchProducts(query = ""): unknown {
  const list = activeProducts().products || [];
  if (!query.trim()) return { products: list };
  const ranked = list
    .map((s) => ({ score: scoreMatch(stringify(s), query), item: s }))
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
  return { products: ranked.length ? ranked : list };
}

export function searchPortfolio(query = ""): unknown {
  const kb = loadKnowledge();
  const list = kb.portfolio.demos || [];
  if (!query.trim()) return { demos: list, note: kb.portfolio.note };
  const ranked = list
    .map((s) => ({ score: scoreMatch(stringify(s), query), item: s }))
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
  return { demos: ranked.length ? ranked : list.slice(0, 6), note: kb.portfolio.note };
}

export function searchFaqs(query = ""): unknown {
  const kb = loadKnowledge();
  const list = kb.faqs.faqs || [];
  if (!query.trim()) return { faqs: list };
  const ranked = list
    .map((s) => ({ score: scoreMatch(`${s.q} ${s.a}`, query), item: s }))
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
  return { faqs: ranked.length ? ranked : list.slice(0, 5) };
}

export function companyBrief(): string {
  const c = loadKnowledge().company;
  return [
    `Company: ${c.brand}`,
    `Positioning: ${c.positioning}`,
    `Email: ${c.email}`,
    `WhatsApp: ${c.whatsapp}`,
    `Website: ${c.website}`,
    `Hours: ${c.hours}`,
  ].join("\n");
}

export function knowledgeIndex(): string {
  const kb = loadKnowledge();
  const serviceNames = (kb.services.services || []).map((s) => s.title).join(", ");
  const productNames = (activeProducts().products || [])
    .map((p) => `${p.name} (${p.status})`)
    .join(", ");
  const industries = (kb.portfolio.demos || []).map((d) => d.industry).join(", ");
  return [
    companyBrief(),
    `Services available: ${serviceNames}`,
    `Products: ${productNames}`,
    `Portfolio demo industries: ${industries}`,
    catalogPricing || catalogProducts
      ? "Plans/products sourced from live Catalog Manager when available (names and inclusions only — never amounts)."
      : "Use tools to look up plans, FAQs, services, products, and portfolio showcases.",
    "Never disclose or invent prices. Describe plans only. Custom software is always quoted after requirements.",
  ].join("\n");
}

/** Pure helpers exported for unit tests */
export const __test = { scoreMatch, KNOWLEDGE_DIR, activePricing, activeProducts };
