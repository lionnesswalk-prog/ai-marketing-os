import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "./prisma";

export type AppRole = "admin" | "marketing_manager" | "sales" | "viewer";

export type AppSession = {
  email: string;
  role: AppRole;
  name?: string;
  userId: string;
  workspaceId: string;
  platformAdmin?: boolean;
};

type SessionTokenPayload = Partial<AppSession> & {
  email: string;
  role: AppRole;
  iat: number;
  exp: number;
};

const SESSION_COOKIE = "amos_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function authSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured) return configured;
  if (process.env.AUTH_MODE === "database") {
    throw new Error("AUTH_SECRET is required when AUTH_MODE=database");
  }
  return "ai-marketing-os-preview-only-change-before-production";
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function createSessionToken(session: AppSession) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    ...session,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionToken(token: string | undefined): AppSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionTokenPayload;
    if (!payload.email || !payload.role || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Preview sessions can be upgraded transparently after deployments. Database
    // sessions must always be bound to a real user and workspace.
    if (!payload.userId || !payload.workspaceId) {
      if (process.env.AUTH_MODE === "database") return null;
      return {
        email: payload.email,
        role: payload.role,
        name: payload.name,
        userId: "preview_user",
        workspaceId: "preview_workspace",
        platformAdmin: true,
      };
    }

    return {
      email: payload.email,
      role: payload.role,
      name: payload.name,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      platformAdmin: Boolean(payload.platformAdmin),
    };
  } catch {
    return null;
  }
}

export async function setSession(session: AppSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<AppSession | null> {
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  if (process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres") {
    try {
      const prisma = getPrisma();
      const access = await prisma.workspaceAccess.findUnique({
        where: {
          userId_workspaceId: {
            userId: session.userId,
            workspaceId: session.workspaceId,
          },
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
              isPlatformAdmin: true,
            },
          },
        },
      });
      if (!access) return null;
      return {
        ...session,
        email: access.user.email,
        name: access.user.name ?? undefined,
        role: access.role as AppRole,
        platformAdmin: access.user.isPlatformAdmin,
      };
    } catch {
      return null;
    }
  }

  return session;
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function canDecideApprovals(role: AppRole) {
  return role === "admin" || role === "marketing_manager";
}


export function canManageMarketing(role: AppRole) {
  return role === "admin" || role === "marketing_manager";
}

export function canManageLeads(role: AppRole) {
  return role === "admin" || role === "marketing_manager" || role === "sales";
}

export function canManageIntegrations(role: AppRole) {
  return role === "admin" || role === "marketing_manager";
}
