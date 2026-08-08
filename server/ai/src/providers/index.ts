import type { ChatProvider } from "../types";
import { createOpenAiProvider } from "./openai";
import { createGeminiProvider } from "./gemini";

export type ProviderName = "openai" | "claude" | "gemini" | "local";

export interface ResolvedAiProvider {
  name: ProviderName;
  apiKey: string;
  model: string;
  ready: boolean;
}

export interface AiProviderConfig {
  enabled: boolean;
  provider?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

/**
 * Resolve active provider + credentials from config.
 * Default provider is Gemini.
 */
export function resolveAiProvider(ai: AiProviderConfig): ResolvedAiProvider {
  const raw = String(ai.provider || "gemini").toLowerCase().trim();
  const name = (["openai", "gemini", "claude", "local"].includes(raw)
    ? raw
    : "gemini") as ProviderName;

  if (name === "openai") {
    const apiKey = String(ai.openaiApiKey || "");
    return {
      name,
      apiKey,
      model: String(ai.openaiModel || "gpt-4o-mini"),
      ready: Boolean(ai.enabled && apiKey),
    };
  }

  if (name === "gemini") {
    const apiKey = String(ai.geminiApiKey || "");
    return {
      name,
      apiKey,
      model: String(ai.geminiModel || "gemini-3.6-flash"),
      ready: Boolean(ai.enabled && apiKey),
    };
  }

  // Stubs for future providers — not ready until implemented
  return {
    name,
    apiKey: "",
    model: "",
    ready: false,
  };
}

/**
 * Provider factory. Application code must never import SDKs directly.
 */
export function createChatProvider(name: ProviderName, apiKey: string): ChatProvider {
  switch (name) {
    case "openai":
      return createOpenAiProvider(apiKey);
    case "gemini":
      return createGeminiProvider(apiKey);
    case "claude":
    case "local":
      throw new Error(`Provider "${name}" is not implemented yet`);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export { createOpenAiProvider, createGeminiProvider };
