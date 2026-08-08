import OpenAI from "openai";
import type {
  ChatMessage,
  ChatProvider,
  ChatProviderOptions,
  ProviderStreamEvent,
  ToolCall,
  ToolDefinition,
} from "../types";

function toOpenAiMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId || "",
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: "function" as const,
          function: { name: t.name, arguments: t.arguments },
        })),
      };
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    };
  });
}

function toOpenAiTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class OpenAiProvider implements ChatProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *streamChat(options: ChatProviderOptions): AsyncGenerator<ProviderStreamEvent> {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: options.model,
          messages: toOpenAiMessages(options.messages),
          tools: options.tools?.length ? toOpenAiTools(options.tools) : undefined,
          stream: true,
        },
        { signal: options.signal }
      );

      const toolAcc = new Map<number, { id: string; name: string; arguments: string }>();
      let emittedTokens = false;

      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          yield { type: "error", error: "cancelled" };
          return;
        }
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;

        if (delta?.content) {
          emittedTokens = true;
          yield { type: "token", content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const prev = toolAcc.get(idx) || { id: "", name: "", arguments: "" };
            if (tc.id) prev.id = tc.id;
            if (tc.function?.name) prev.name = tc.function.name;
            if (tc.function?.arguments) prev.arguments += tc.function.arguments;
            toolAcc.set(idx, prev);
          }
        }

        if (choice.finish_reason === "tool_calls" || (choice.finish_reason && toolAcc.size > 0 && !emittedTokens)) {
          const toolCalls: ToolCall[] = [...toolAcc.values()].map((t) => ({
            id: t.id,
            name: t.name,
            arguments: t.arguments,
          }));
          if (toolCalls.length) {
            yield { type: "tool_calls", toolCalls };
            return;
          }
        }
      }

      if (toolAcc.size > 0 && !emittedTokens) {
        yield {
          type: "tool_calls",
          toolCalls: [...toolAcc.values()].map((t) => ({
            id: t.id,
            name: t.name,
            arguments: t.arguments,
          })),
        };
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
      console.error("[Onairo AI] OpenAI error:", message);
      yield { type: "error", error: "provider_failed" };
    }
  }
}

export function createOpenAiProvider(apiKey: string): ChatProvider {
  return new OpenAiProvider(apiKey);
}
