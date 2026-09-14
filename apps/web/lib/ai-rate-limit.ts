import { createHash } from "node:crypto";
import { getPrisma } from "./prisma";

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX = 60;

function enabled() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function limit() {
  const parsed = Number.parseInt(process.env.AI_REQUESTS_PER_HOUR || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX;
}

function key(workspaceId: string, feature: string) {
  return createHash("sha256").update(`ai:${workspaceId}:${feature}`).digest("hex");
}

export async function consumeAiRequest(workspaceId: string, feature: string) {
  if (!enabled()) return;
  const prisma = getPrisma();
  const throttleKey = key(workspaceId, feature);
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const max = limit();

  await prisma.$transaction(async (tx) => {
    const current = await tx.authThrottle.findUnique({ where: { key: throttleKey } });

    if (!current || current.windowStart < cutoff) {
      await tx.authThrottle.upsert({
        where: { key: throttleKey },
        create: { key: throttleKey, attempts: 1, windowStart: now, blockedUntil: null },
        update: { attempts: 1, windowStart: now, blockedUntil: null },
      });
      return;
    }

    if (current.attempts >= max) {
      throw new Error("AI_RATE_LIMITED");
    }

    await tx.authThrottle.update({
      where: { key: throttleKey },
      data: { attempts: { increment: 1 } },
    });
  });
}

export function aiRateLimitLabel() {
  return `${limit()} AI generations per workspace per hour`;
}
