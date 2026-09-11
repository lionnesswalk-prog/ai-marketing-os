import { createHash, randomBytes } from "node:crypto";
import type { AppRole, AppSession } from "./auth";
import { setSession } from "./auth";
import { hashPassword } from "./password";
import { getPrisma } from "./prisma";
import { recordAuditEvent } from "./audit";
import { assertBillingMemberCapacity } from "./billing";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLES: AppRole[] = ["admin", "marketing_manager", "sales", "viewer"];

export type WorkspaceMemberView = {
  userId: string;
  email: string;
  name?: string;
  role: AppRole;
  currentUser: boolean;
  joinedAt: string;
};

export type WorkspaceInviteView = {
  id: string;
  email: string;
  role: AppRole;
  expiresAt: string;
  createdAt: string;
};

export type PublicInviteView = {
  email: string;
  role: AppRole;
  workspaceId: string;
  workspaceName: string;
  brandName?: string;
  status: "active" | "expired" | "accepted" | "revoked";
};

function databaseReady() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function role(value: string): AppRole {
  return ROLES.includes(value as AppRole) ? value as AppRole : "viewer";
}

function requireRole(value: string): AppRole {
  if (!ROLES.includes(value as AppRole)) throw new Error("ROLE_INVALID");
  return value as AppRole;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireAdmin(session: AppSession) {
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");
  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId: session.workspaceId,
      },
    },
  });
  if (!access || access.role !== "admin") throw new Error("ADMIN_REQUIRED");
  return access;
}

async function activeAdminCount(workspaceId: string) {
  return getPrisma().workspaceAccess.count({
    where: { workspaceId, role: "admin" },
  });
}

export async function listWorkspaceMembers(session: AppSession): Promise<{
  members: WorkspaceMemberView[];
  invites: WorkspaceInviteView[];
}> {
  if (!databaseReady()) {
    return {
      members: [{
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        currentUser: true,
        joinedAt: new Date().toISOString(),
      }],
      invites: [],
    };
  }

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
    members: members.map((item) => ({
      userId: item.userId,
      email: item.user.email,
      name: item.user.name ?? undefined,
      role: role(item.role),
      currentUser: item.userId === session.userId,
      joinedAt: item.createdAt.toISOString(),
    })),
    invites: invites.map((item) => ({
      id: item.id,
      email: item.email,
      role: role(item.role),
      expiresAt: item.expiresAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function createWorkspaceInvite(
  session: AppSession,
  input: { email: string; role: string },
) {
  await requireAdmin(session);
  const prisma = getPrisma();
  const email = normalizeEmail(input.email);
  const inviteRole = requireRole(input.role);
  if (!email.includes("@")) throw new Error("EMAIL_INVALID");
  if (email === session.email.toLowerCase()) throw new Error("INVITE_SELF");

  const existingUser = await prisma.workspaceUser.findUnique({ where: { email } });
  if (existingUser) {
    const existingAccess = await prisma.workspaceAccess.findUnique({
      where: {
        userId_workspaceId: {
          userId: existingUser.id,
          workspaceId: session.workspaceId,
        },
      },
    });
    if (existingAccess) throw new Error("ALREADY_MEMBER");
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

  await assertBillingMemberCapacity(session.workspaceId);

  const token = randomBytes(32).toString("base64url");
  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: session.workspaceId,
      email,
      role: inviteRole,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdBy: session.userId,
    },
  });

  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "workspace_invite_created",
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    payload: {
      email,
      role: inviteRole,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });

  return {
    id: invite.id,
    token,
    email,
    role: inviteRole,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function revokeWorkspaceInvite(session: AppSession, inviteId: string) {
  await requireAdmin(session);
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findFirst({
    where: { id: inviteId, workspaceId: session.workspaceId, acceptedAt: null, revokedAt: null },
  });
  if (!invite) throw new Error("INVITE_NOT_FOUND");
  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "workspace_invite_revoked",
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    payload: { email: invite.email, role: invite.role },
  });
}

export async function getPublicInvite(token: string): Promise<PublicInviteView | null> {
  if (!databaseReady() || token.length < 20) return null;
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      workspace: {
        include: { brands: { orderBy: { createdAt: "asc" }, take: 1 } },
      },
    },
  });
  if (!invite) return null;

  let status: PublicInviteView["status"] = "active";
  if (invite.acceptedAt) status = "accepted";
  else if (invite.revokedAt) status = "revoked";
  else if (invite.expiresAt.getTime() <= Date.now()) status = "expired";

  return {
    email: invite.email,
    role: role(invite.role),
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace.name,
    brandName: invite.workspace.brands[0]?.name,
    status,
  };
}

export async function acceptWorkspaceInvite(session: AppSession, token: string): Promise<AppSession> {
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: tokenHash(token) },
  });
  if (!invite) throw new Error("INVITE_INVALID");
  if (invite.acceptedAt) throw new Error("INVITE_ACCEPTED");
  if (invite.revokedAt) throw new Error("INVITE_REVOKED");
  if (invite.expiresAt.getTime() <= Date.now()) throw new Error("INVITE_EXPIRED");
  if (normalizeEmail(session.email) !== invite.email) throw new Error("INVITE_EMAIL_MISMATCH");

  const acceptedRole = role(invite.role);
  await prisma.$transaction([
    prisma.workspaceAccess.upsert({
      where: {
        userId_workspaceId: {
          userId: session.userId,
          workspaceId: invite.workspaceId,
        },
      },
      create: {
        userId: session.userId,
        workspaceId: invite.workspaceId,
        role: acceptedRole,
      },
      update: { role: acceptedRole },
    }),
    prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: invite.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "workspace_invite_accepted",
    entityType: "WorkspaceInvite",
    entityId: invite.id,
    payload: { email: invite.email, role: acceptedRole },
  });

  const next: AppSession = {
    ...session,
    workspaceId: invite.workspaceId,
    role: acceptedRole,
  };
  await setSession(next);
  return next;
}

export async function registerFromWorkspaceInvite(input: {
  token: string;
  name: string;
  password: string;
}): Promise<AppSession> {
  if (!databaseReady()) throw new Error("DATABASE_MODE_REQUIRED");
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: tokenHash(input.token) },
  });
  if (!invite) throw new Error("INVITE_INVALID");
  if (invite.acceptedAt) throw new Error("INVITE_ACCEPTED");
  if (invite.revokedAt) throw new Error("INVITE_REVOKED");
  if (invite.expiresAt.getTime() <= Date.now()) throw new Error("INVITE_EXPIRED");

  const duplicate = await prisma.workspaceUser.findUnique({ where: { email: invite.email } });
  if (duplicate) throw new Error("ACCOUNT_EXISTS");

  const name = input.name.trim();
  if (name.length < 2 || input.password.length < 8) throw new Error("ACCOUNT_INPUT_INVALID");
  const passwordHash = await hashPassword(input.password);
  const acceptedRole = role(invite.role);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.workspaceUser.create({
      data: {
        workspaceId: invite.workspaceId,
        email: invite.email,
        name,
        passwordHash,
        role: acceptedRole,
        lastLoginAt: new Date(),
      },
    });
    await tx.workspaceAccess.create({
      data: {
        userId: user.id,
        workspaceId: invite.workspaceId,
        role: acceptedRole,
      },
    });
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return user;
  });

  await recordAuditEvent({
    workspaceId: invite.workspaceId,
    actorType: "workspace_user",
    actorId: created.id,
    action: "invite_account_created",
    entityType: "WorkspaceUser",
    entityId: created.id,
    payload: { email: created.email, role: acceptedRole },
  });

  const session: AppSession = {
    userId: created.id,
    workspaceId: invite.workspaceId,
    email: created.email,
    name: created.name ?? undefined,
    role: acceptedRole,
  };
  await setSession(session);
  return session;
}

export async function updateWorkspaceMemberRole(
  session: AppSession,
  userId: string,
  nextRoleInput: string,
) {
  await requireAdmin(session);
  const prisma = getPrisma();
  const nextRole = requireRole(nextRoleInput);
  const access = await prisma.workspaceAccess.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: session.workspaceId,
      },
    },
    include: { user: true },
  });
  if (!access) throw new Error("MEMBER_NOT_FOUND");

  if (access.role === "admin" && nextRole !== "admin" && await activeAdminCount(session.workspaceId) <= 1) {
    throw new Error("LAST_ADMIN");
  }

  await prisma.workspaceAccess.update({
    where: { id: access.id },
    data: { role: nextRole },
  });
  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "member_role_updated",
    entityType: "WorkspaceAccess",
    entityId: access.id,
    payload: {
      email: access.user.email,
      previousRole: access.role,
      nextRole,
    },
  });

  if (userId === session.userId) {
    await setSession({ ...session, role: nextRole });
  }
}

export async function removeWorkspaceMember(session: AppSession, userId: string) {
  await requireAdmin(session);
  if (userId === session.userId) throw new Error("CANNOT_REMOVE_SELF");

  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: session.workspaceId,
      },
    },
    include: { user: true },
  });
  if (!access) throw new Error("MEMBER_NOT_FOUND");
  if (access.role === "admin" && await activeAdminCount(session.workspaceId) <= 1) {
    throw new Error("LAST_ADMIN");
  }

  await prisma.workspaceAccess.delete({ where: { id: access.id } });
  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "member_access_revoked",
    entityType: "WorkspaceAccess",
    entityId: access.id,
    payload: { email: access.user.email, role: access.role },
  });
}
