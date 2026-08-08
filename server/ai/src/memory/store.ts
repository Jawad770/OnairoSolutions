import type { PrismaClient } from "@prisma/client";
import type { ChatMessage } from "../types";

export interface ConversationRecord {
  id: string;
  sessionId: string;
  status: string;
  leadId: number | null;
  summary: string | null;
  intentScore: number | null;
  confidenceScore: number | null;
  metadataJson: unknown;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function retentionExpiry(retentionDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + retentionDays);
  return d;
}

export async function createConversation(
  prisma: PrismaClient,
  sessionId: string,
  retentionDays: number
): Promise<ConversationRecord> {
  const row = await prisma.aiConversation.create({
    data: {
      sessionId,
      status: "active",
      expiresAt: retentionExpiry(retentionDays),
    },
  });
  return row as ConversationRecord;
}

export async function getConversation(
  prisma: PrismaClient,
  conversationId: string
): Promise<ConversationRecord | null> {
  const row = await prisma.aiConversation.findUnique({ where: { id: conversationId } });
  return row as ConversationRecord | null;
}

export async function closeConversation(prisma: PrismaClient, conversationId: string): Promise<void> {
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { status: "closed" },
  });
}

export async function linkLeadToConversation(
  prisma: PrismaClient,
  conversationId: string,
  leadId: number,
  summary: string,
  intentScore?: number,
  confidenceScore?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: {
      status: "converted",
      leadId,
      summary,
      intentScore: intentScore ?? null,
      confidenceScore: confidenceScore ?? null,
      expiresAt: null,
      metadataJson: (metadata as object) || undefined,
    },
  });
}

export async function appendMessage(
  prisma: PrismaClient,
  conversationId: string,
  role: string,
  content: string,
  toolName?: string,
  toolPayload?: unknown
): Promise<void> {
  await prisma.aiMessage.create({
    data: {
      conversationId,
      role,
      content,
      toolName: toolName || null,
      toolPayload: toolPayload ? (toolPayload as object) : undefined,
    },
  });
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function loadHistory(
  prisma: PrismaClient,
  conversationId: string,
  maxMessages: number
): Promise<ChatMessage[]> {
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId, role: { in: ["user", "assistant", "system", "tool"] } },
    orderBy: { createdAt: "asc" },
    take: maxMessages,
  });
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
    }));
}

export async function countMessages(prisma: PrismaClient, conversationId: string): Promise<number> {
  return prisma.aiMessage.count({ where: { conversationId } });
}

export async function getMessagesForTranscript(
  prisma: PrismaClient,
  conversationId: string
): Promise<Array<{ role: string; content: string; createdAt: Date; toolName: string | null }>> {
  return prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, createdAt: true, toolName: true },
  });
}

export async function findConversationByLeadId(
  prisma: PrismaClient,
  leadId: number
): Promise<ConversationRecord | null> {
  const row = await prisma.aiConversation.findFirst({
    where: { leadId },
    orderBy: { updatedAt: "desc" },
  });
  return row as ConversationRecord | null;
}

export function sanitizeUserMessage(input: string, maxLength: number): string {
  return String(input || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
