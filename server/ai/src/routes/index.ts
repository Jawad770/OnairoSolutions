import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import type { AiDeps } from "../types";
import { runChat } from "../orchestrator";
import {
  closeConversation,
  createConversation,
  getConversation,
  getMessagesForTranscript,
  findConversationByLeadId,
  newSessionId,
  sanitizeUserMessage,
} from "../memory/store";
import { startRetentionScheduler } from "../memory/retention";
import { resolveAiProvider } from "../providers";

const activeAbortControllers = new Map<string, AbortController>();

function sendSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function registerAiRoutes(app: Express, deps: AiDeps): void {
  const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: deps.config.ai.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Too many requests. Please wait a moment and try again." },
  });

  startRetentionScheduler(deps.prisma);

  app.get("/api/ai/status", (_req, res) => {
    const resolved = resolveAiProvider(deps.config.ai);
    res.json({
      ok: true,
      enabled: deps.config.ai.enabled,
      ready: resolved.ready,
      provider: resolved.name,
      message: resolved.ready
        ? "Onairo AI is available"
        : "Onairo AI is temporarily unavailable",
    });
  });

  app.post("/api/ai/session", aiLimiter, async (req, res) => {
    try {
      const resolved = resolveAiProvider(deps.config.ai);
      if (!resolved.ready) {
        return res.status(503).json({
          ok: false,
          error: "Our AI consultant is temporarily unavailable. Please WhatsApp our team.",
        });
      }
      const sessionId =
        sanitizeUserMessage(String(req.body?.sessionId || ""), 80) || newSessionId();
      const conversation = await createConversation(
        deps.prisma,
        sessionId,
        deps.config.ai.retentionDays
      );
      return res.json({
        ok: true,
        sessionId,
        conversationId: conversation.id,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Onairo AI] session error:", (err as Error)?.message || err);
      return res.status(500).json({ ok: false, error: "Could not start a conversation. Please try again." });
    }
  });

  app.post("/api/ai/conversation/restart", aiLimiter, async (req, res) => {
    try {
      const conversationId = String(req.body?.conversationId || "");
      const sessionId =
        sanitizeUserMessage(String(req.body?.sessionId || ""), 80) || newSessionId();
      if (conversationId) {
        const existing = await getConversation(deps.prisma, conversationId);
        if (existing && existing.status === "active") {
          await closeConversation(deps.prisma, conversationId);
        }
      }
      const conversation = await createConversation(
        deps.prisma,
        sessionId,
        deps.config.ai.retentionDays
      );
      return res.json({ ok: true, sessionId, conversationId: conversation.id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Onairo AI] restart error:", (err as Error)?.message || err);
      return res.status(500).json({ ok: false, error: "Could not restart the conversation." });
    }
  });

  app.post("/api/ai/chat/cancel", aiLimiter, (req, res) => {
    const conversationId = String(req.body?.conversationId || "");
    const ctrl = activeAbortControllers.get(conversationId);
    if (ctrl) {
      ctrl.abort();
      activeAbortControllers.delete(conversationId);
    }
    res.json({ ok: true });
  });

  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    const conversationId = String(req.body?.conversationId || "");
    const message = String(req.body?.message || "");

    if (!conversationId) {
      return res.status(400).json({ ok: false, error: "Missing conversationId." });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const ctrl = new AbortController();
    activeAbortControllers.set(conversationId, ctrl);
    req.on("close", () => {
      ctrl.abort();
      activeAbortControllers.delete(conversationId);
    });

    try {
      for await (const chunk of runChat(deps, conversationId, message, ctrl.signal)) {
        if (ctrl.signal.aborted) break;
        if (chunk.type === "token") sendSse(res, "token", { content: chunk.content });
        else if (chunk.type === "tool_start") sendSse(res, "tool_start", { tool: chunk.toolName });
        else if (chunk.type === "tool_result") sendSse(res, "tool_result", { tool: chunk.toolName });
        else if (chunk.type === "lead") sendSse(res, "lead", chunk.data);
        else if (chunk.type === "error") {
          sendSse(res, "error", { message: chunk.content });
          break;
        } else if (chunk.type === "done") sendSse(res, "done", {});
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Onairo AI] chat error:", (err as Error)?.message || err);
      sendSse(res, "error", {
        message: "Something went wrong. Please try again.",
      });
    } finally {
      activeAbortControllers.delete(conversationId);
      res.end();
    }
  });

  // Staff: fetch AI transcript by conversation id
  app.get(
    `${deps.config.portalRoute}/api/ai/conversations/:id`,
    async (req: Request, res: Response) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const authz = require("../../authz");
      const sessionUser = (req as Request & { session?: { user?: { id?: number } } }).session?.user;
      if (!sessionUser) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      try {
        const id = String(req.params.id);
        const conversation = await getConversation(deps.prisma, id);
        if (!conversation) return res.status(404).json({ ok: false, error: "Not found" });

        const allowed =
          authz.isSuperAdmin(sessionUser.id) ||
          authz.can(req, "ai.view") ||
          authz.can(req, "leads.view_all") ||
          (conversation.leadId != null &&
            authz.can(req, "leads.view") &&
            (await leadOwnedBy(deps, conversation.leadId, sessionUser.id)));
        if (!allowed) {
          return res.status(403).json({ ok: false, error: "Forbidden" });
        }

        const messages = await getMessagesForTranscript(deps.prisma, id);
        return res.json({
          ok: true,
          conversation: {
            id: conversation.id,
            status: conversation.status,
            leadId: conversation.leadId,
            summary: conversation.summary,
            intentScore: conversation.intentScore,
            confidenceScore: conversation.confidenceScore,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          },
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            toolName: m.toolName,
            createdAt: m.createdAt,
          })),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Onairo AI] transcript error:", (err as Error)?.message || err);
        return res.status(500).json({ ok: false, error: "Could not load transcript" });
      }
    }
  );

  app.get(
    `${deps.config.portalRoute}/api/ai/leads/:leadId/conversation`,
    async (req: Request, res: Response) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const authz = require("../../authz");
      const sessionUser = (req as Request & { session?: { user?: { id?: number } } }).session?.user;
      if (!sessionUser) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
      try {
        const leadId = Number(req.params.leadId);
        const allowed =
          authz.isSuperAdmin(sessionUser.id) ||
          authz.can(req, "ai.view") ||
          authz.can(req, "leads.view_all") ||
          (authz.can(req, "leads.view") && (await leadOwnedBy(deps, leadId, sessionUser.id)));
        if (!allowed) {
          return res.status(403).json({ ok: false, error: "Forbidden" });
        }

        const conversation = await findConversationByLeadId(deps.prisma, leadId);
        if (!conversation) return res.status(404).json({ ok: false, error: "No AI conversation linked" });
        const messages = await getMessagesForTranscript(deps.prisma, conversation.id);
        return res.json({
          ok: true,
          conversation: {
            id: conversation.id,
            status: conversation.status,
            leadId: conversation.leadId,
            summary: conversation.summary,
            intentScore: conversation.intentScore,
            confidenceScore: conversation.confidenceScore,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          },
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            toolName: m.toolName,
            createdAt: m.createdAt,
          })),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Onairo AI] lead conversation error:", (err as Error)?.message || err);
        return res.status(500).json({ ok: false, error: "Could not load conversation" });
      }
    }
  );
}

async function leadOwnedBy(
  deps: AiDeps,
  leadId: number,
  userId: number | undefined
): Promise<boolean> {
  if (!userId || !Number.isFinite(leadId)) return false;
  try {
    const lead = await deps.prisma.lead.findFirst({
      where: { id: leadId },
      select: { assignedUserId: true, assignedToUserId: true },
    });
    if (!lead) return false;
    const owner = lead.assignedUserId ?? lead.assignedToUserId;
    return Number(owner) === Number(userId);
  } catch {
    return false;
  }
}
