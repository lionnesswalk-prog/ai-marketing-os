import { cookies } from "next/headers";
import type { AppRole, AppSession } from "./auth";
import { createSessionToken, readSessionToken, setSession } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { getPrisma } from "./prisma";

const PREVIEW_ACCOUNT_COOKIE = "amos_preview_account";
const PREVIEW_ACCOUNT_TTL = 60 * 60 * 24 * 30;
const PREVIEW_USER_ID = "preview_user";
const PREVIEW_WORKSPACE_ID = "preview_workspace";

type PreviewAccount = {
  email: string;
  name: string;
  passwordHash: string;
  role: AppRole;
};

export type AccountProfile = {
  email: string;
  name: string;
  role: AppRole;
  workspaceName: string;
};

function authMode() {
  return process.env.AUTH_MODE === "database" ? "database" : "preview";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function previewSession(account: Pick<PreviewAccount, "email" | "name" | "role">): AppSession {
  return {
    email: account.email,
    name: account.name,
    role: account.role,
    userId: PREVIEW_USER_ID,
    workspaceId: PREVIEW_WORKSPACE_ID,
  };
}

async function writePreviewAccount(account: PreviewAccount) {
  const store = await cookies();
  const payload = Buffer.from(JSON.stringify(account)).toString("base64url");
  const envelope = createSessionToken({
    email: payload,
    role: "viewer",
    userId: PREVIEW_USER_ID,
    workspaceId: PREVIEW_WORKSPACE_ID,
  });
  store.set(PREVIEW_ACCOUNT_COOKIE, envelope, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREVIEW_ACCOUNT_TTL,
  });
}

async function readPreviewAccount(): Promise<PreviewAccount | null> {
  const store = await cookies();
  const envelope = store.get(PREVIEW_ACCOUNT_COOKIE)?.value;
  const signedPayload = readSessionToken(envelope);
  if (!signedPayload?.email) return null;
  try {
    const account = JSON.parse(Buffer.from(signedPayload.email, "base64url").toString("utf8")) as PreviewAccount;
    if (!account.email || !account.passwordHash || !account.role) return null;
    return account;
  } catch {
    return null;
  }
}

async function ensureDefaultWorkspace() {
  const prisma = getPrisma();
  const existing = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.workspace.create({
    data: {
      name: process.env.DEFAULT_WORKSPACE_NAME ?? "AI Marketing OS",
      brands: { create: { name: process.env.DEFAULT_BRAND_NAME ?? "Lioness Walk" } },
    },
  });
}

function sessionFromDatabaseUser(user: {
  id: string;
  workspaceId: string;
  email: string;
  name: string | null;
  role: string;
}): AppSession {
  return {
    userId: user.id,
    workspaceId: user.workspaceId,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role as AppRole,
  };
}

export async function registerAccount(input: { name: string; email: string; password: string; brandName?: string }): Promise<AppSession> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const brandName = input.brandName?.trim() || name;
  const passwordHash = await hashPassword(input.password);

  if (authMode() === "preview") {
    const account: PreviewAccount = { email, name, passwordHash, role: "admin" };
    await writePreviewAccount(account);
    return previewSession(account);
  }

  const prisma = getPrisma();
  const duplicate = await prisma.workspaceUser.findUnique({ where: { email } });
  if (duplicate) throw new Error("ACCOUNT_EXISTS");

  const signupMode = process.env.SIGNUP_MODE ?? "open";
  if (signupMode === "closed") throw new Error("SIGNUP_CLOSED");

  const created = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: `${brandName} Workspace`,
        brands: {
          create: {
            name: brandName,
            voiceJson: {
              personality: ["intentional", "clear", "brand-specific"],
              avoid: ["unsupported claims", "fake urgency"],
            },
          },
        },
      },
    });

    const user = await tx.workspaceUser.create({
      data: {
        workspaceId: workspace.id,
        email,
        name,
        passwordHash,
        role: "admin",
        lastLoginAt: new Date(),
      },
    });

    await tx.workspaceAccess.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "admin",
      },
    });

    return user;
  });

  return sessionFromDatabaseUser(created);
}

export async function authenticateAccount(input: { email: string; password: string }): Promise<AppSession> {
  const email = normalizeEmail(input.email);

  if (authMode() === "preview") {
    const account = await readPreviewAccount();
    if (!account || account.email !== email || !(await verifyPassword(input.password, account.passwordHash))) {
      throw new Error("INVALID_CREDENTIALS");
    }
    return previewSession(account);
  }

  const prisma = getPrisma();
  const user = await prisma.workspaceUser.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error("INVALID_CREDENTIALS");
  }
  const access = await prisma.workspaceAccess.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!access) throw new Error("ACCOUNT_ACCESS_NOT_FOUND");
  await prisma.workspaceUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return {
    userId: user.id,
    workspaceId: access.workspaceId,
    email: user.email,
    name: user.name ?? undefined,
    role: access.role as AppRole,
  };
}

export async function getAccountProfile(session: AppSession): Promise<AccountProfile> {
  if (authMode() === "preview") {
    const account = await readPreviewAccount();
    if (!account || account.email !== session.email) {
      return {
        email: session.email,
        name: session.name ?? session.email.split("@")[0],
        role: session.role,
        workspaceName: process.env.DEFAULT_WORKSPACE_NAME ?? "AI Marketing OS",
      };
    }
    return {
      email: account.email,
      name: account.name,
      role: account.role,
      workspaceName: process.env.DEFAULT_WORKSPACE_NAME ?? "AI Marketing OS",
    };
  }

  const prisma = getPrisma();
  const [user, workspace, access] = await Promise.all([
    prisma.workspaceUser.findUnique({ where: { id: session.userId } }),
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.workspaceAccess.findUnique({
      where: { userId_workspaceId: { userId: session.userId, workspaceId: session.workspaceId } },
    }),
  ]);
  if (!user || !workspace || !access) throw new Error("ACCOUNT_NOT_FOUND");
  return {
    email: user.email,
    name: user.name ?? user.email.split("@")[0],
    role: access.role as AppRole,
    workspaceName: workspace.name,
  };
}

export async function updateAccountProfile(
  session: AppSession,
  input: { name: string; email: string },
): Promise<AppSession> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (authMode() === "preview") {
    const account = await readPreviewAccount();
    if (!account || account.email !== session.email) throw new Error("ACCOUNT_NOT_FOUND");
    const updated: PreviewAccount = { ...account, name, email };
    await writePreviewAccount(updated);
    const nextSession = previewSession(updated);
    await setSession(nextSession);
    return nextSession;
  }

  const prisma = getPrisma();
  const user = await prisma.workspaceUser.findUnique({
    where: { id: session.userId },
  });
  if (!user) throw new Error("ACCOUNT_NOT_FOUND");

  if (email !== user.email) {
    const duplicate = await prisma.workspaceUser.findUnique({ where: { email } });
    if (duplicate && duplicate.id !== user.id) throw new Error("ACCOUNT_EXISTS");
  }

  const updated = await prisma.workspaceUser.update({
    where: { id: user.id },
    data: { name, email },
  });
  const nextSession: AppSession = {
    ...session,
    email: updated.email,
    name: updated.name ?? undefined,
  };
  await setSession(nextSession);
  return nextSession;
}

export async function changeAccountPassword(
  session: AppSession,
  input: { currentPassword: string; newPassword: string },
) {
  if (authMode() === "preview") {
    const account = await readPreviewAccount();
    if (!account || account.email !== session.email) throw new Error("ACCOUNT_NOT_FOUND");
    if (!(await verifyPassword(input.currentPassword, account.passwordHash))) throw new Error("INVALID_PASSWORD");
    await writePreviewAccount({ ...account, passwordHash: await hashPassword(input.newPassword) });
    return;
  }

  const prisma = getPrisma();
  const user = await prisma.workspaceUser.findUnique({
    where: { id: session.userId },
  });
  if (!user?.passwordHash) throw new Error("ACCOUNT_NOT_FOUND");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new Error("INVALID_PASSWORD");
  await prisma.workspaceUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}

export function getAuthMode() {
  return authMode();
}
