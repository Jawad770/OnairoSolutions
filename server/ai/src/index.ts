import type { Express } from "express";
import type { AiDeps } from "./types";
import { registerAiRoutes } from "./routes";
import {
  reloadKnowledge,
  syncCatalogKnowledge,
  searchPricing,
  searchServices,
  searchProducts,
  searchPortfolio,
  searchFaqs,
  __test as knowledgeTest,
} from "./knowledge/loader";
import { validateLeadInput, normalizeWhatsapp } from "./tools";
import { isExpired } from "./memory/retention";
import { resolveAiProvider } from "./providers";

export function registerAi(app: Express, deps: AiDeps): void {
  const resolved = resolveAiProvider(deps.config.ai);
  if (deps.config.ai.enabled && !resolved.apiKey) {
    // Soft validation — do not crash; status/session will report unavailable.
    // eslint-disable-next-line no-console
    console.warn(
      `[Onairo AI] AI_PROVIDER=${resolved.name} is enabled but the API key is missing. AI will report unavailable until configured.`
    );
  } else if (deps.config.ai.enabled && resolved.ready) {
    // eslint-disable-next-line no-console
    console.log(`[Onairo AI] Provider ready: ${resolved.name} (${resolved.model})`);
  }
  registerAiRoutes(app, deps);
  void syncCatalogKnowledge().then((ok) => {
    if (ok) {
      // eslint-disable-next-line no-console
      console.log("[Onairo AI] Catalog knowledge synced from live Catalog Manager");
    }
  });
  const timer = setInterval(() => {
    void syncCatalogKnowledge();
  }, 5 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

export {
  registerAiRoutes,
  reloadKnowledge,
  searchPricing,
  searchServices,
  searchProducts,
  searchPortfolio,
  searchFaqs,
  validateLeadInput,
  normalizeWhatsapp,
  isExpired,
  knowledgeTest,
  resolveAiProvider,
};

export type { AiDeps };
