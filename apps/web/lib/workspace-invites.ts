import { createHash, randomBytes } from "node:crypto";
import type { AppRole, AppSession } from "./auth";
import { setSession } from "./auth";
import { hashPassword } from "./password";
import { getPrisma } from "./prisma";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const roles: AppRole[] = ["admin", "marketing_manager", "sales", "viewer"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function role(value: string): AppRole {
  return roles.includes(value as AppRole) ? value as AppRole : "viewer";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function databaseReady() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

async function requireWorkspaceAdmin(session: AppSession) {
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");
  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId: session.workspaceId } },
  });
  if (!access || access.role !== "admin") throw new Error("WORKSPACE_ADMIN_REQUIRED");
  return access;
}

export async function createWorkspaceInvite(
  session: AppSession,
  input: { email: string; role: AppRole },
) {
  await requireWorkspaceAdmin(session);
  const email = normalizeEmail(input.email);
  const inviteRole = role(input.role);
  if (!email.includes("@")) throw new Error("INVITE_EMAIL_INVALID");

  const prisma = getPrisma();
  const existingUser = await prisma.workspaceUser.findUnique({ where: { email } });
  if (existingUser) {
    const access = await prisma.workspaceAccess.findUnique({
      where: { userId_workspaceId: { userId: existingUser.id, workspaceId: session.workspaceId } },
    });
    if (access) throw new Error("MEMBER_ALREADY_EXISTS");
  }

  await prisma.workspaceInvite.updateMany({
    where: {
      workspaceId: session.workspaceId,
      email,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString("base64url");
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: session.workspaceId,
      email,
      role: inviteRole,
      tokenHash: tokenHash(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdBy: session.userId,
    },
    include: { workspace: true },
  });

  return {
    id: invite.id,
    token: rawToken,
    email: invite.email,
    role: role(invite.role),
    workspaceName: invite.workspace.name,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function getWorkspaceInvite(token: string) {
  if (!databaseReady()) return null;
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { workspace: true },
  });
  if (!invite) return null;

  const active = !invite.acceptedAt && !invite.revokedAt && invite.expiresAt.getTime() > Date.now();
  return {
    id: invite.id,
    email: invite.email,
    role: role(invite.role),
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace.name,
    expiresAt: invite.expiresAt.toISOString(),
    active,
    accepted: Boolean(invite.acceptedAt),
    revoked: Boolean(invite.revokedAt),
    expired: invite.expiresAt.getTime() <= Date.now(),
  };
}

async function activeInvite(token: string) {
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: tokenHash(token) },
  });
  if (!invite) throw new Error("INVITE_NOT_FOUND");
  if (invite.acceptedAt) throw new Error("INVITE_ALREADY_ACCEPTED");
  if (invite.revokedAt) throw new Error("INVITE_REVOKED");
  if (invite.expiresAt.getTime() <= Date.now()) throw new Error("INVITE_EXPIRED");
  return invite;
}

export async function acceptWorkspaceInvite(session: AppSession, token: string) {
  const invite = await activeInvite(token);
  if (normalizeEmail(session.email) !== normalizeEmail(invite.email)) throw new Error("INVITE_EMAIL_MISMATCH");

  const prisma = getPrisma();
  const inviteRole = role(invite.role);
  await prisma.$transaction([
    prisma.workspaceAccess.upsert({
      where: { userId_workspaceId: { userId: session.userId, workspaceId: invite.workspaceId } },
      create: { userId: session.userId, workspaceId: invite.workspaceId, role: inviteRole },
      update: { role: inviteRole },
    }),
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  const next: AppSession = {
    ...session,
    workspaceId: invite.workspaceId,
    role: inviteRole,
  };
  await setSession(next);
  return next;
}

export async function registerFromWorkspaceInvite(
  token: string,
  input: { name: string; password: string },
): Promise<AppSession> {
  const invite = await activeInvite(token);
  const name = input.name.trim();
  if (name.length < 2 || input.password.length < 8) throw new Error("INVITE_SIGNUP_INVALID");

  const prisma = getPrisma();
  const duplicate = await prisma.workspaceUser.findUnique({ where: { email: invite.email } });
  if (duplicate) throw new Error("ACCOUNT_EXISTS_USE_LOGIN");

  const inviteRole = role(invite.role);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceUser.create({
      data: {
        workspaceId: invite.workspaceId,
        email: invite.email,
        name,
        passwordHash,
        role: inviteRole,
        lastLoginAt: new Date(),
      },
    });
    await tx.workspaceAccess.create({
      data: {
        userId: created.id,
        workspaceId: invite.workspaceId,
        role: inviteRole,
      },
    });
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return created;
  });

  const session: AppSession = {
    userId: user.id,
    workspaceId: invite.workspaceId,
    email: user.email,
    name: user.name ?? undefined,
    role: inviteRole,
  };
  await setSession(session);
  return session;
}

export async function listWorkspaceTeam(session: AppSession) {
  if (!databaseReady()) return { members: [], invites: [] };
  const prisma = getPrisma();
  const [members, invites] = await Promise.all([
    prisma.workspaceAccess.findMany({
      where: { workspaceId: session.workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceInvite.findMany({
      where: {
        workspaceId: session.workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    members: members.map((member) => ({
      userId: member.userId,
      name: member.user.name || member.user.email.split("@")[0],
      email: member.user.email,
      role: role(member.role),
      isCurrentUser: member.userId === session.userId,
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: role(invite.role),
      expiresAt: invite.expiresAt.toISOString(),
    })),
  };
}

export async function revokeWorkspaceInvite(session: AppSession, inviteId: string) {
  await requireWorkspaceAdmin(session);
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findFirst({
    where: { id: inviteId, workspaceId: session.workspaceId, acceptedAt: null },
  });
  if (!invite) throw new Error("INVITE_NOT_FOUND");
  await prisma.workspaceInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
}

export async function updateWorkspaceMemberRole(
  session: AppSession,
  userId: string,
  nextRole: AppRole,
) {
  await requireWorkspaceAdmin(session);
  if (userId === session.userId) throw new Error("SELF_ROLE_CHANGE_FORBIDDEN");
  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: session.workspaceId } },
  });
  if (!access) throw new Error("MEMBER_NOT_FOUND");
  await prisma.workspaceAccess.update({
    where: { id: access.id },
    data: { role: role(nextRole) },
  });
}

export async function removeWorkspaceMember(session: AppSession, userId: string) {
  await requireWorkspaceAdmin(session);
  if (userId === session.userId) throw new Error("SELF_REMOVE_FORBIDDEN");
  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: session.workspaceId } },
  });
  if (!access) throw new Error("MEMBER_NOT_FOUND");
  await prisma.workspaceAccess.delete({ where: { id: access.id } });
}
