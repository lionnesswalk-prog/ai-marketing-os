import { createHash } from "node:crypto";
import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

type XTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token: string;
  scope?: string;
  refresh_token?: string;
};

type XUser = {
  id: string;
  name: string;
  username: string;
};

export type XConnection = {
  source: "env" | "database";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  userId?: string;
  username?: string;
  name?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function storageReady() {
  return usePostgres() && canEncryptIntegrations();
}

function appConfigured() {
  return Boolean(process.env.X_CLIENT_ID);
}

function allowSharedEnv() {
  return process.env.ALLOW_SHARED_ENV_INTEGRATIONS === "true" || !usePostgres();
}

async function currentBrand(brandId?: string) {
  const prisma = getPrisma();
  if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new Error("BRAND_NOT_FOUND");
    return brand;
  }
  const session = await getSession();
  if (!session?.workspaceId) throw new Error("WORKSPACE_SESSION_REQUIRED");
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand;
}

export function getXSetupState() {
  return { appConfigured: appConfigured(), storageReady: storageReady() };
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildXOAuthUrl(redirectUri: string, state: string, codeChallenge: string) {
  if (!process.env.X_CLIENT_ID) throw new Error("X_CLIENT_ID_REQUIRED");
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.X_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function tokenRequest(fields: Record<string, string>) {
  if (!process.env.X_CLIENT_ID) throw new Error("X_CLIENT_ID_REQUIRED");
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(fields);
  if (process.env.X_CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64")}`;
  } else {
    body.set("client_id", process.env.X_CLIENT_ID);
  }

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({})) as Partial<XTokenResponse> & { error_description?: string; error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `X token request failed (${response.status})`);
  }
  return json as XTokenResponse;
}

export async function exchangeXCode(code: string, redirectUri: string, codeVerifier: string) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const userResponse = await fetch("https://api.x.com/2/users/me?user.fields=id,name,username", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const userJson = await userResponse.json().catch(() => ({})) as { data?: XUser; detail?: string; title?: string };
  if (!userResponse.ok || !userJson.data?.id) {
    throw new Error(userJson.detail || userJson.title || "X user lookup failed");
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    scope: token.scope,
    user: userJson.data,
  };
}

export async function saveXConnection(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  user: XUser;
}) {
  if (!storageReady()) throw new Error("X_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();
  const metadataJson = {
    accessToken: encryptIntegrationSecret(input.accessToken),
    refreshToken: input.refreshToken ? encryptIntegrationSecret(input.refreshToken) : null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    scope: input.scope || null,
    userId: input.user.id,
    username: input.user.username,
    name: input.user.name,
    connectedAt: new Date().toISOString(),
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "x" } },
    create: {
      brandId: brand.id,
      provider: "x",
      externalAccountId: input.user.id,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId: input.user.id,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectXConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "x" } });
}

async function refreshDatabaseToken(connectionId: string, refreshToken: string) {
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const prisma = getPrisma();
  const row = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!row?.metadataJson || typeof row.metadataJson !== "object") throw new Error("X_CONNECTION_NOT_FOUND");
  const current = row.metadataJson as Record<string, unknown>;
  const nextMetadata = {
    accessToken: encryptIntegrationSecret(token.access_token),
    refreshToken: encryptIntegrationSecret(token.refresh_token || refreshToken),
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    scope: token.scope || (typeof current.scope === "string" ? current.scope : null),
    userId: typeof current.userId === "string" ? current.userId : null,
    username: typeof current.username === "string" ? current.username : null,
    name: typeof current.name === "string" ? current.name : null,
    connectedAt: typeof current.connectedAt === "string" ? current.connectedAt : new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
  };
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { metadataJson: nextMetadata },
  });
  return token.access_token;
}

export async function getXConnection(brandId?: string): Promise<XConnection | null> {
  if (allowSharedEnv() && process.env.X_ACCESS_TOKEN) {
    return {
      source: "env",
      accessToken: process.env.X_ACCESS_TOKEN,
      refreshToken: process.env.X_REFRESH_TOKEN,
      userId: process.env.X_USER_ID,
      username: process.env.X_USERNAME,
      name: process.env.X_ACCOUNT_LABEL,
    };
  }

  if (!storageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand(brandId);
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "x" } },
  });
  if (!row || row.status !== "connected" || !row.metadataJson || typeof row.metadataJson !== "object") return null;

  const meta = row.metadataJson as Record<string, unknown>;
  const encryptedAccess = typeof meta.accessToken === "string" ? meta.accessToken : undefined;
  if (!encryptedAccess) return null;
  let accessToken = decryptIntegrationSecret(encryptedAccess);
  const encryptedRefresh = typeof meta.refreshToken === "string" ? meta.refreshToken : undefined;
  const refreshToken = encryptedRefresh ? decryptIntegrationSecret(encryptedRefresh) : undefined;
  const expiresAt = typeof meta.expiresAt === "string" ? meta.expiresAt : undefined;

  if (expiresAt && refreshToken && new Date(expiresAt).getTime() < Date.now() + 60_000) {
    accessToken = await refreshDatabaseToken(row.id, refreshToken);
  }

  return {
    source: "database",
    accessToken,
    refreshToken,
    expiresAt,
    userId: typeof meta.userId === "string" ? meta.userId : undefined,
    username: typeof meta.username === "string" ? meta.username : undefined,
    name: typeof meta.name === "string" ? meta.name : undefined,
  };
}

function buildText(input: { caption: string; hashtags?: string; cta?: string; linkUrl?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.linkUrl?.trim(), input.hashtags?.trim()].filter(Boolean).join("\n\n");
}

export async function publishX(input: {
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  contentType: string;
}, brandId?: string) {
  const connection = await getXConnection(brandId);
  if (!connection) throw new Error("X_NOT_CONNECTED");
  if (input.mediaUrl) throw new Error("X_MEDIA_UPLOAD_NOT_READY");
  if (["reel", "video", "short", "story", "carousel"].includes(input.contentType)) {
    throw new Error("X_FORMAT_NOT_READY");
  }

  const text = buildText(input);
  if (!text) throw new Error("X_TEXT_REQUIRED");

  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({})) as { data?: { id?: string; text?: string }; detail?: string; title?: string };
  if (!response.ok || !json.data?.id) {
    throw new Error(json.detail || json.title || `X publish failed (${response.status})`);
  }
  return json.data;
}
