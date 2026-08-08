import type { PrismaClient } from "@prisma/client";

/**
 * Delete anonymous (non-converted) conversations past expiresAt.
 * Converted / lead-linked conversations are permanent (expiresAt = null).
 */
export async function pruneExpiredConversations(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const expired = await prisma.aiConversation.findMany({
    where: {
      expiresAt: { lte: now },
      leadId: null,
      status: { not: "converted" },
    },
    select: { id: true },
  });
  if (!expired.length) return 0;
  const ids = expired.map((c) => c.id);
  await prisma.aiMessage.deleteMany({ where: { conversationId: { in: ids } } });
  const result = await prisma.aiConversation.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}

export function startRetentionScheduler(
  prisma: PrismaClient,
  intervalMs = 24 * 60 * 60 * 1000
): NodeJS.Timeout {
  const run = () => {
    pruneExpiredConversations(prisma)
      .then((n) => {
        if (n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[Onairo AI] Pruned ${n} expired conversation(s)`);
        }
      })
      .catch((err) => {
        const code = err?.code || "";
        // P2021: table missing during early boot / incomplete migrate — ignore quietly
        if (code === "P2021" || /does not exist/i.test(String(err?.message || ""))) return;
        // eslint-disable-next-line no-console
        console.error("[Onairo AI] Retention prune failed:", err?.message || err);
      });
  };
  // Delay first run so Prisma migrations / app.ready can finish first
  const startup = setTimeout(run, 8_000);
  if (typeof startup.unref === "function") startup.unref();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

/** Pure helper for tests */
export function isExpired(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}
