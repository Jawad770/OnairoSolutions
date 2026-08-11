import type { ToolDefinition, AiDeps, LeadSubmitInput } from "../types";
import {
  searchPricing,
  searchServices,
  searchProducts,
  searchPortfolio,
  searchFaqs,
} from "../knowledge/loader";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_pricing",
    description:
      "Look up Onairo website packages and EduTrack plans (names, inclusions, who they suit). Never return or invent numeric prices — commercial terms are quote-only.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional filter e.g. website, EduTrack, starter" },
      },
    },
  },
  {
    name: "search_services",
    description: "Search Onairo client services (websites, software, automation, AI, design, etc.).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the visitor needs" },
      },
    },
  },
  {
    name: "search_products",
    description: "Search commercial products (EduTrack and upcoming Track suite).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    },
  },
  {
    name: "search_portfolio",
    description: "Find industry demo websites to recommend (dental, gym, school, etc.).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Industry or business type" },
      },
    },
  },
  {
    name: "search_faqs",
    description: "Search frequently asked questions about Onairo, plans, EduTrack, timelines.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    },
  },
  {
    name: "submit_crm_lead",
    description:
      "Submit a qualified lead to the Onairo CRM when the visitor has buying intent and provided name plus email or WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        businessName: { type: "string" },
        email: { type: "string" },
        whatsapp: { type: "string" },
        requestedService: { type: "string" },
        recommendedSolution: { type: "string" },
        summary: {
          type: "string",
          description: "Clean sales summary for the team (short paragraphs / bullets).",
        },
        intentScore: { type: "integer", description: "Buying intent 0-100" },
        confidenceScore: { type: "integer", description: "AI confidence 0-100" },
      },
      required: ["name", "summary"],
    },
  },
];

export function normalizeWhatsapp(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("03") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  if (digits.length >= 10) return digits;
  return null;
}

export function validateLeadInput(input: Partial<LeadSubmitInput>): { ok: true; data: LeadSubmitInput } | { ok: false; error: string } {
  const name = String(input.name || "").trim();
  if (!name || name.length < 2) {
    return { ok: false, error: "Name is required (at least 2 characters)." };
  }
  const email = String(input.email || "").trim().toLowerCase() || undefined;
  const whatsappRaw = String(input.whatsapp || "").trim() || undefined;
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null;
  if (!email && !whatsapp) {
    return { ok: false, error: "Provide at least one contact method: email or WhatsApp." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email format looks invalid." };
  }
  const summary = String(input.summary || "").trim();
  if (!summary) {
    return { ok: false, error: "A conversation summary is required for the sales team." };
  }
  const clamp = (n: unknown) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return undefined;
    return Math.max(0, Math.min(100, Math.round(v)));
  };
  return {
    ok: true,
    data: {
      name,
      businessName: String(input.businessName || "").trim() || undefined,
      email,
      whatsapp: whatsapp || undefined,
      requestedService: String(input.requestedService || "").trim() || undefined,
      recommendedSolution: String(input.recommendedSolution || "").trim() || undefined,
      summary,
      intentScore: clamp(input.intentScore),
      confidenceScore: clamp(input.confidenceScore),
      conversationId: String(input.conversationId || ""),
    },
  };
}

export function submitCrmLead(deps: AiDeps, input: LeadSubmitInput): { ok: true; leadId: number; leadCode: string } | { ok: false; error: string } {
  const validated = validateLeadInput(input);
  if (!validated.ok) return validated;

  const data = validated.data;
  const lead = deps.insertLead({
    sourceType: "onairo_ai",
    name: data.name,
    business: data.businessName || null,
    serviceProduct: data.recommendedSolution || data.requestedService || null,
    email: data.email || null,
    whatsapp: data.whatsapp || null,
    phone: data.whatsapp || null,
    preferredContactMethod: data.whatsapp ? "WhatsApp" : "Email",
    projectDescription: data.summary,
    status: "New",
    metadataJson: {
      source: "Onairo AI",
      recommendedSolution: data.recommendedSolution || null,
      requestedService: data.requestedService || null,
      intentScore: data.intentScore ?? null,
      confidenceScore: data.confidenceScore ?? null,
      conversationId: data.conversationId,
    },
  });

  deps.state.activities.push({
    id: deps.nextId("activities"),
    lead_id: lead.id,
    user_id: null,
    action_type: "LEAD_CREATED",
    description: "Lead created from Onairo AI consultant",
    created_at: deps.now(),
  });
  deps.persist();

  return {
    ok: true,
    leadId: Number(lead.id),
    leadCode: String(lead.lead_code || ""),
  };
}

export async function executeTool(
  name: string,
  argsJson: string,
  deps: AiDeps,
  conversationId: string
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { error: "Invalid tool arguments JSON" };
  }
  const query = String(args.query || "");

  switch (name) {
    case "search_pricing":
      return searchPricing(query);
    case "search_services":
      return searchServices(query);
    case "search_products":
      return searchProducts(query);
    case "search_portfolio":
      return searchPortfolio(query);
    case "search_faqs":
      return searchFaqs(query);
    case "submit_crm_lead": {
      const result = submitCrmLead(deps, {
        ...(args as Partial<LeadSubmitInput>),
        conversationId,
        name: String(args.name || ""),
        summary: String(args.summary || ""),
      });
      return result;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
