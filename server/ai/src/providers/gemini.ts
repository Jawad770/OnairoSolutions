import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
} from "@google/generative-ai";
import type {
  ChatMessage,
  ChatProvider,
  ChatProviderOptions,
  ProviderStreamEvent,
  ToolCall,
  ToolDefinition,
} from "../types";

function extractSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else rest.push(m);
  }
  return { system: systemParts.join("\n\n"), rest };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toToolCall(part: Part, index: number): ToolCall {
  const call = part.functionCall!;
  const signature = (part as { thoughtSignature?: string }).thoughtSignature;
  return {
    id: `gemini_${call.name}_${index}`,
    name: call.name,
    arguments: JSON.stringify(call.args || {}),
    ...(signature ? { signature } : {}),
  };
}

function toGeminiTools(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters as unknown as FunctionDeclaration["parameters"],
  }));
}

/**
 * Convert provider-agnostic messages into Gemini contents.
 * Tool results become user `functionResponse` parts (Gemini protocol).
 */
function toGeminiContents(messages: ChatMessage[]): Content[] {
  const contents: Content[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content || "" }] });
      continue;
    }

    if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          // Gemini 3 rejects function-call history unless the original
          // thought signature is returned with the call.
          parts.push({
            functionCall: {
              name: tc.name,
              args: parseArgs(tc.arguments),
            },
            ...(tc.signature ? { thoughtSignature: tc.signature } : {}),
          } as Part);
        }
      }
      if (!parts.length) parts.push({ text: "" });
      contents.push({ role: "model", parts });
      continue;
    }

    if (m.role === "tool") {
      let response: Record<string, unknown>;
      try {
        const parsed = JSON.parse(m.content || "{}");
        response =
          parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : { result: parsed };
      } catch {
        response = { result: m.content };
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.name || "tool",
              response,
            },
          },
        ],
      });
    }
  }

  // Gemini requires alternating user/model roles — merge consecutive same-role turns.
  const merged: Content[] = [];
  for (const c of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === c.role) {
      prev.parts = [...(prev.parts || []), ...(c.parts || [])];
    } else {
      merged.push({ role: c.role, parts: [...(c.parts || [])] });
    }
  }
  return merged;
}

export class GeminiProvider implements ChatProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *streamChat(options: ChatProviderOptions): AsyncGenerator<ProviderStreamEvent> {
    try {
      const { system, rest } = extractSystem(options.messages);
      const contents = toGeminiContents(rest);

      if (!contents.length) {
        yield { type: "error", error: "provider_failed" };
        return;
      }

      // Gemini requires the last turn to be from the user
      if (contents[contents.length - 1]?.role !== "user") {
        contents.push({ role: "user", parts: [{ text: "Continue." }] });
      }

      const model = this.client.getGenerativeModel({
        model: options.model,
        systemInstruction: system || undefined,
        tools: options.tools?.length
          ? [{ functionDeclarations: toGeminiTools(options.tools) }]
          : undefined,
      });

      const requestOptions = options.signal ? { signal: options.signal } : undefined;
      const streaming = await model.generateContentStream({ contents }, requestOptions);

      const toolAcc: ToolCall[] = [];
      let emittedTokens = false;

      for await (const chunk of streaming.stream) {
        if (options.signal?.aborted) {
          yield { type: "error", error: "cancelled" };
          return;
        }

        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            emittedTokens = true;
            yield { type: "token", content: part.text };
          }
          if (part.functionCall?.name) {
            toolAcc.push(toToolCall(part, toolAcc.length));
          }
        }
      }

      if (toolAcc.length) {
        yield { type: "tool_calls", toolCalls: toolAcc };
        return;
      }

      yield { type: "done" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provider error";
      if (options.signal?.aborted || /abort/i.test(message)) {
        yield { type: "error", error: "cancelled" };
        return;
      }
      // eslint-disable-next-line no-console
      console.error("[Onairo AI] Gemini error:", message);
      yield { type: "error", error: "provider_failed" };
    }
  }
}

export function createGeminiProvider(apiKey: string): ChatProvider {
  return new GeminiProvider(apiKey);
}
