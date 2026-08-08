import type { AiDeps, ChatMessage, StreamChunk } from "./types";
import { createChatProvider, resolveAiProvider } from "./providers";
import { buildSystemPrompt } from "./behaviour/load";
import { knowledgeIndex } from "./knowledge/loader";
import { TOOL_DEFINITIONS, executeTool } from "./tools";
import {
  appendMessage,
  countMessages,
  getConversation,
  linkLeadToConversation,
  loadHistory,
  sanitizeUserMessage,
} from "./memory/store";

const MAX_TOOL_ROUNDS = 4;

export async function* runChat(
  deps: AiDeps,
  conversationId: string,
  rawMessage: string,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const ai = deps.config.ai;
  const resolved = resolveAiProvider(ai);
  if (!resolved.ready) {
    yield {
      type: "error",
      content:
        "Our AI consultant is temporarily unavailable. Please try again shortly or WhatsApp our team.",
    };
    return;
  }

  const conversation = await getConversation(deps.prisma, conversationId);
  if (!conversation || conversation.status === "closed") {
    yield { type: "error", content: "This conversation is no longer active. Please start a new chat." };
    return;
  }

  const message = sanitizeUserMessage(rawMessage, ai.maxMessageLength);
  if (!message) {
    yield { type: "error", content: "Please enter a message." };
    return;
  }

  const msgCount = await countMessages(deps.prisma, conversationId);
  if (msgCount >= ai.maxMessagesPerConversation) {
    yield {
      type: "error",
      content:
        "This conversation has reached its length limit. Restart the chat or contact our team on WhatsApp.",
    };
    return;
  }

  await appendMessage(deps.prisma, conversationId, "user", message);

  const history = await loadHistory(deps.prisma, conversationId, ai.maxMessagesPerConversation);
  const system: ChatMessage = {
    role: "system",
    content: buildSystemPrompt(knowledgeIndex()),
  };

  const provider = createChatProvider(resolved.name, resolved.apiKey);
  let working: ChatMessage[] = [system, ...history];
  let assistantText = "";
  let leadLinked: { leadId: number; leadCode: string } | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) {
      yield { type: "error", content: "cancelled" };
      return;
    }

    let toolCallsThisRound: Array<{ id: string; name: string; arguments: string }> | null = null;
    let roundText = "";

    for await (const event of provider.streamChat({
      model: resolved.model,
      messages: working,
      tools: TOOL_DEFINITIONS,
      signal,
    })) {
      if (event.type === "token" && event.content) {
        roundText += event.content;
        assistantText += event.content;
        yield { type: "token", content: event.content };
      } else if (event.type === "tool_calls" && event.toolCalls?.length) {
        toolCallsThisRound = event.toolCalls;
      } else if (event.type === "error") {
        if (event.error === "cancelled") {
          yield { type: "error", content: "cancelled" };
          return;
        }
        yield {
          type: "error",
          content: "Something went wrong on our side. Please try again in a moment.",
        };
        return;
      }
    }

    if (!toolCallsThisRound?.length) {
      break;
    }

    working.push({
      role: "assistant",
      content: roundText || "",
      toolCalls: toolCallsThisRound,
    });

    for (const tc of toolCallsThisRound) {
      yield { type: "tool_start", toolName: tc.name };
      const result = await executeTool(tc.name, tc.arguments, deps, conversationId);
      await appendMessage(
        deps.prisma,
        conversationId,
        "tool",
        JSON.stringify(result),
        tc.name,
        result
      );

      if (
        tc.name === "submit_crm_lead" &&
        result &&
        typeof result === "object" &&
        (result as { ok?: boolean }).ok === true
      ) {
        const leadResult = result as { ok: true; leadId: number; leadCode: string };
        leadLinked = leadResult;
        let summary = "";
        let intentScore: number | undefined;
        let confidenceScore: number | undefined;
        try {
          const parsed = JSON.parse(tc.arguments) as Record<string, unknown>;
          summary = String(parsed.summary || "");
          intentScore = Number(parsed.intentScore);
          confidenceScore = Number(parsed.confidenceScore);
        } catch {
          /* ignore */
        }
        await linkLeadToConversation(
          deps.prisma,
          conversationId,
          leadResult.leadId,
          summary,
          Number.isFinite(intentScore) ? intentScore : undefined,
          Number.isFinite(confidenceScore) ? confidenceScore : undefined,
          { leadCode: leadResult.leadCode }
        );
        yield {
          type: "lead",
          data: { leadId: leadResult.leadId, leadCode: leadResult.leadCode },
        };
      }

      working.push({
        role: "tool",
        content: JSON.stringify(result),
        toolCallId: tc.id,
        name: tc.name,
      });
      yield { type: "tool_result", toolName: tc.name, data: result };
    }
  }

  if (assistantText.trim()) {
    await appendMessage(deps.prisma, conversationId, "assistant", assistantText.trim());
  } else if (!leadLinked) {
    let closing = "";
    for await (const event of provider.streamChat({
      model: resolved.model,
      messages: [
        ...working,
        {
          role: "user",
          content: "Based on the tool results, reply to the visitor helpfully now. Do not call tools.",
        },
      ],
      signal,
    })) {
      if (event.type === "token" && event.content) {
        closing += event.content;
        yield { type: "token", content: event.content };
      } else if (event.type === "error") {
        break;
      }
    }
    if (closing.trim()) {
      await appendMessage(deps.prisma, conversationId, "assistant", closing.trim());
    }
  }

  yield { type: "done" };
}
