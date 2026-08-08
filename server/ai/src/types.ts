export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  /** Opaque provider continuity token (Gemini thought signatures) — must be echoed back verbatim. */
  signature?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface StreamChunk {
  type: "token" | "tool_start" | "tool_result" | "done" | "error" | "lead";
  content?: string;
  toolName?: string;
  data?: unknown;
}

export interface ChatProviderOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ProviderStreamEvent {
  type: "token" | "tool_calls" | "done" | "error";
  content?: string;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ChatProvider {
  readonly name: string;
  streamChat(options: ChatProviderOptions): AsyncGenerator<ProviderStreamEvent>;
}

export interface AiDeps {
  config: {
    portalRoute: string;
    ai: {
      enabled: boolean;
      provider: string;
      openaiApiKey: string;
      openaiModel: string;
      geminiApiKey: string;
      geminiModel: string;
      rateLimitMax: number;
      maxMessageLength: number;
      maxMessagesPerConversation: number;
      retentionDays: number;
    };
  };
  insertLead: (payload: Record<string, unknown>) => Record<string, unknown>;
  persist: () => void;
  state: {
    activities: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  nextId: (table: string) => number;
  now: () => string;
  prisma: import("@prisma/client").PrismaClient;
}

export interface LeadSubmitInput {
  name: string;
  businessName?: string;
  email?: string;
  whatsapp?: string;
  requestedService?: string;
  recommendedSolution?: string;
  summary: string;
  intentScore?: number;
  confidenceScore?: number;
  conversationId: string;
}
