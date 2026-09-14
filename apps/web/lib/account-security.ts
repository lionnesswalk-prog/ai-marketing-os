import { createHash, randomBytes } from "node:crypto";
import type { AppSession } from "./auth";
import { clearSession } from "./auth";
import { sendTransactionalEmail } from "./email";
import { hashPassword } from "./password";
import { getPrisma } from "./prisma";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanOrigin(origin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (origin) {
    try { return new URL(origin).origin; } catch {}
  }
  return "https://ai-marketing-os-ashy.vercel.app";
}

async function createToken(userId: string, type: "verify_email" | "password_reset", ttlMinutes: number) {
  const prisma = getPrisma();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.accountToken.deleteMany({
      where: { userId, type, usedAt: null },
    }),
    prisma.accountToken.create({
      data: { userId, type, tokenHash, expiresAt },
    }),
  ]);

  return token;
}

export async function sendVerificationEmail(session: AppSession, origin?: string) {
  const prisma = getPrisma();
  const user = await prisma.workspaceUser.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) throw new Error("ACCOUNT_NOT_FOUND");
  if (user.emailVerifiedAt) return { alreadyVerified: true };

  const token = await createToken(user.id, "verify_email", 24 * 60);
  const link = cleanOrigin(origin) + "/verify-email?token=" + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email,
    subject: "Verify your AI Marketing OS email",
    html: `<p>Hi ${user.name || "there"},</p><p>Verify your email to secure your AI Marketing OS account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
  return { alreadyVerified: false };
}

export async function verifyEmailToken(token: string) {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);
  const row = await prisma.accountToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.type !== "verify_email" || row.usedAt || row.expiresAt <= new Date()) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  await prisma.$transaction([
    prisma.workspaceUser.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.accountToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function requestPasswordReset(email: string, origin?: string) {
  const prisma = getPrisma();
  const user = await prisma.workspaceUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;

  const token = await createToken(user.id, "password_reset", 60);
  const link = cleanOrigin(origin) + "/reset-password?token=" + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your AI Marketing OS password",
    html: `<p>Hi ${user.name || "there"},</p><p>Use the secure link below to reset your password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 60 minutes. If you did not request this, ignore this email.</p>`,
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);
  const row = await prisma.accountToken.findUnique({ where: { tokenHash } });
  if (!row || row.type !== "password_reset" || row.usedAt || row.expiresAt <= new Date()) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.workspaceUser.update({
      where: { id: row.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.accountToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.accountToken.deleteMany({
      where: { userId: row.userId, type: "password_reset", usedAt: null },
    }),
  ]);
}

export async function deleteAccountAndOwnedData(session: AppSession) {
  if (session.platformAdmin) throw new Error("PLATFORM_ADMIN_DELETE_BLOCKED");

  const prisma = getPrisma();
  const accesses = await prisma.workspaceAccess.findMany({
    where: { userId: session.userId },
    select: { workspaceId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const access of accesses) {
      const memberCount = await tx.workspaceAccess.count({ where: { workspaceId: access.workspaceId } });
      if (memberCount <= 1) {
        await tx.workspace.delete({ where: { id: access.workspaceId } });
      } else {
        await tx.workspaceAccess.delete({
          where: { userId_workspaceId: { userId: session.userId, workspaceId: access.workspaceId } },
        });
      }
    }
    await tx.workspaceUser.delete({ where: { id: session.userId } });
  });

  await clearSession();
}
