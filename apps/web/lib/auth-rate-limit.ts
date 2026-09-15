import { createHash } from "node:crypto";
import { getPrisma } from "./prisma";
import { isDatabaseMode } from "./runtime-mode";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function enabled() {
  return isDatabaseMode();
}

function hash(kind: string, value: string) {
  return createHash("sha256").update(kind + ":" + value.trim().toLowerCase()).digest("hex");
}

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function authIpFromHeaders(headers: { get(name: string): string | null }) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function loginThrottleKeysFromValues(ip: string, email: string) {
  return [hash("login-ip", ip), hash("login-email", email)];
}

export function signupThrottleKeysFromValues(ip: string, email: string) {
  return [hash("signup-ip", ip), hash("signup-email", email)];
}

export function recoveryThrottleKeysFromValues(ip: string, email: string) {
  return [hash("recovery-ip", ip), hash("recovery-email", email)];
}

export function loginThrottleKeys(request: Request, email: string) {
  return loginThrottleKeysFromValues(requestIp(request), email);
}

export function signupThrottleKeys(request: Request, email: string) {
  return signupThrottleKeysFromValues(requestIp(request), email);
}

export async function assertAuthAllowed(keys: string[]) {
  if (!enabled()) return;
  const rows = await getPrisma().authThrottle.findMany({
    where: { key: { in: keys }, blockedUntil: { gt: new Date() } },
    select: { blockedUntil: true },
  });
  if (rows.length) throw new Error("AUTH_RATE_LIMITED");
}

export async function recordAuthAttempt(keys: string[]) {
  if (!enabled()) return;
  const prisma = getPrisma();
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);

  for (const key of keys) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.authThrottle.findUnique({ where: { key } });
      if (!current || current.windowStart < cutoff) {
        await tx.authThrottle.upsert({
          where: { key },
          create: { key, attempts: 1, windowStart: now, blockedUntil: null },
          update: { attempts: 1, windowStart: now, blockedUntil: null },
        });
        return;
      }

      const attempts = current.attempts + 1;
      await tx.authThrottle.update({
        where: { key },
        data: {
          attempts,
          blockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : current.blockedUntil,
        },
      });
    });
  }
}

export async function clearAuthAttempts(keys: string[]) {
  if (!enabled()) return;
  await getPrisma().authThrottle.deleteMany({ where: { key: { in: keys } } });
}
