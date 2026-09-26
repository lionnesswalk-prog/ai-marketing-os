import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";
import { isDatabaseMode, isPostgresBackend } from "./runtime-mode";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

export type MetaSettingsView = {
  appId: string;
  secretConfigured: boolean;
  source: "portal" | "environment" | "none";
  revision: string | null;
  updatedAt: string | null;
  storageReady: boolean;
};

type StoredConfig = {
  appId: string;
  secretEncrypted: string;
  revision: string;
  updatedAt: Date;
};

const schema = z.object({
  appId: z.string().trim().regex(/^\d{5,32}$/),
  appSecret: z.string().trim().max(256).refine((value) => value === "" || /^\S{16,256}$/.test(value)),
  revision: z.string().max(80).nullable(),
}).strict();

function environmentCredentials() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

function credentialsFromRow(row: StoredConfig) {
  // Bind the encrypted secret to the provider and App ID, preventing row swaps.
  const payload = JSON.parse(decryptIntegrationSecret(row.secretEncrypted));
  if (payload.provider !== "meta" || payload.appId !== row.appId || typeof payload.appSecret !== "string" || !payload.appSecret) {
    throw new Error("META_SETTINGS_UNAVAILABLE");
  }
  return { appId: row.appId, appSecret: payload.appSecret as string };
}

async function storedConfig() {
  if (!isPostgresBackend()) return null;
  return getPrisma().platformProviderConfig.findUnique({ where: { provider: "meta" } });
}

function view(row: StoredConfig | null): MetaSettingsView {
  const fallback = environmentCredentials();
  return {
    appId: row?.appId || fallback?.appId || "",
    secretConfigured: row ? Boolean(row.secretEncrypted) : Boolean(fallback),
    source: row ? "portal" : fallback ? "environment" : "none",
    revision: row?.revision || null,
    updatedAt: row?.updatedAt.toISOString() || null,
    storageReady: isDatabaseMode() && Boolean(process.env.DATABASE_URL) && canEncryptIntegrations(),
  };
}

// Server use only: neither this result nor the stored ciphertext may be sent to a client.
export async function getMetaAppCredentials() {
  try {
    const row = await storedConfig();
    return row ? credentialsFromRow(row) : environmentCredentials();
  } catch {
    // Never silently switch apps if the configured portal credentials cannot be read.
    throw new Error("META_SETTINGS_UNAVAILABLE");
  }
}

export async function getMetaSettingsView(session: AppSession): Promise<MetaSettingsView> {
  if (!session.platformAdmin) throw new Error("PLATFORM_ADMIN_REQUIRED");
  return view(await storedConfig());
}

export async function saveMetaSettings(session: AppSession, input: unknown): Promise<MetaSettingsView> {
  if (!session.platformAdmin) throw new Error("PLATFORM_ADMIN_REQUIRED");
  if (!isDatabaseMode() || !process.env.DATABASE_URL || !canEncryptIntegrations()) {
    throw new Error("META_SETTINGS_STORAGE_REQUIRED");
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("META_SETTINGS_INVALID");
  const { appId, appSecret, revision } = parsed.data;

  try {
    return await getPrisma().$transaction(async (tx) => {
      // Re-check the current database privilege inside the credential write transaction.
      const access = await tx.workspaceAccess.findUnique({
        where: { userId_workspaceId: { userId: session.userId, workspaceId: session.workspaceId } },
        include: { user: { select: { isPlatformAdmin: true, sessionVersion: true } } },
      });
      if (!access?.user.isPlatformAdmin || access.user.sessionVersion !== session.sessionVersion) {
        throw new Error("PLATFORM_ADMIN_REQUIRED");
      }
      const current = await tx.platformProviderConfig.findUnique({ where: { provider: "meta" } });
      if ((current?.revision || null) !== revision) throw new Error("META_SETTINGS_CONFLICT");

      let secret = appSecret;
      if (!secret) {
        const previous = current ? credentialsFromRow(current) : environmentCredentials();
        if (!previous || previous.appId !== appId) throw new Error("META_SETTINGS_SECRET_REQUIRED");
        secret = previous.appSecret;
      }

      const data = {
        appId,
        secretEncrypted: encryptIntegrationSecret(JSON.stringify({ provider: "meta", appId, appSecret: secret })),
        revision: randomUUID(),
        updatedBy: session.userId,
      };
      const saved = await tx.platformProviderConfig.upsert({
        where: { provider: "meta" },
        create: { provider: "meta", ...data },
        update: data,
      });
      const brand = await tx.brand.findFirst({ where: { workspaceId: session.workspaceId }, select: { id: true } });
      if (brand) {
        await tx.auditLog.create({
          data: {
            brandId: brand.id,
            actorType: "user",
            actorId: session.userId,
            action: "platform_meta_settings_updated",
            entityType: "platform_provider",
            entityId: "meta",
            payload: { provider: "meta", secretReplaced: Boolean(appSecret) },
          },
        });
      }
      return view(saved);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "P2034" || error.code === "P2002")) {
      throw new Error("META_SETTINGS_CONFLICT");
    }
    throw error;
  }
}
