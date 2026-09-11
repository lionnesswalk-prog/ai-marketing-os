import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

type TikTokTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
};

type TikTokUser = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
};

export type TikTokPrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export type TikTokCreatorInfo = {
  creatorAvatarUrl?: string;
  creatorUsername?: string;
  creatorNickname?: string;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled?: boolean;
  duetDisabled?: boolean;
  stitchDisabled?: boolean;
  maxVideoPostDurationSec?: number;
};

export type TikTokConnection = {
  source: "env" | "database";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  openId?: string;
  displayName?: string;
  avatarUrl?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function storageReady() {
  return usePostgres() && canEncryptIntegrations();
}

function appConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

function allowSharedEnv() {
  return process.env.ALLOW_SHARED_ENV_INTEGRATIONS === "true" || !usePostgres();
}

async function currentBrand() {
  const session = await getSession();
  if (!session?.workspaceId) throw new Error("WORKSPACE_SESSION_REQUIRED");
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  if (!brand) throw new Error("BRAND_NOT_FOUND");
  return brand;
}

export function getTikTokSetupState() {
  return { appConfigured: appConfigured(), storageReady: storageReady() };
}

export function buildTikTokOAuthUrl(redirectUri: string, state: string) {
  if (!process.env.TIKTOK_CLIENT_KEY) throw new Error("TIKTOK_CLIENT_KEY_REQUIRED");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY);
  url.searchParams.set("scope", "user.info.basic,video.publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(fields: Record<string, string>) {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TIKTOK_APP_NOT_CONFIGURED");
  }

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      ...fields,
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Partial<TikTokTokenResponse> & {
    error?: string;
    error_description?: string;
    log_id?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `TikTok token request failed (${response.status})`);
  }
  return body as TikTokTokenResponse;
}

async function fetchTikTokUser(accessToken: string) {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    data?: { user?: TikTokUser };
    error?: { code?: string; message?: string; log_id?: string };
  };
  if (!response.ok || body.error?.code && body.error.code !== "ok") {
    throw new Error(body.error?.message || `TikTok user lookup failed (${response.status})`);
  }
  return body.data?.user || {};
}

export async function exchangeTikTokCode(code: string, redirectUri: string) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const user = await fetchTikTokUser(token.access_token);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    refreshExpiresIn: token.refresh_expires_in,
    openId: token.open_id || user.open_id,
    scope: token.scope,
    user,
  };
}

export async function saveTikTokConnection(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  openId?: string;
  scope?: string;
  user: TikTokUser;
}) {
  if (!storageReady()) throw new Error("TIKTOK_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();
  const externalAccountId = input.openId || input.user.open_id;
  if (!externalAccountId) throw new Error("TIKTOK_ACCOUNT_ID_MISSING");

  const metadataJson = {
    accessToken: encryptIntegrationSecret(input.accessToken),
    refreshToken: input.refreshToken ? encryptIntegrationSecret(input.refreshToken) : null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    refreshExpiresAt: input.refreshExpiresIn ? new Date(Date.now() + input.refreshExpiresIn * 1000).toISOString() : null,
    openId: externalAccountId,
    displayName: input.user.display_name || null,
    avatarUrl: input.user.avatar_url || null,
    scope: input.scope || null,
    connectedAt: new Date().toISOString(),
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "tiktok" } },
    create: {
      brandId: brand.id,
      provider: "tiktok",
      externalAccountId,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectTikTokConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "tiktok" } });
}

async function refreshDatabaseToken(connectionId: string, refreshToken: string) {
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const prisma = getPrisma();
  const row = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!row?.metadataJson || typeof row.metadataJson !== "object") throw new Error("TIKTOK_CONNECTION_NOT_FOUND");
  const current = row.metadataJson as Record<string, unknown>;
  const nextRefresh = token.refresh_token || refreshToken;
  const metadataJson = {
    accessToken: encryptIntegrationSecret(token.access_token),
    refreshToken: encryptIntegrationSecret(nextRefresh),
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    refreshExpiresAt: token.refresh_expires_in ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() : (
      typeof current.refreshExpiresAt === "string" ? current.refreshExpiresAt : null
    ),
    openId: typeof current.openId === "string" ? current.openId : token.open_id || null,
    displayName: typeof current.displayName === "string" ? current.displayName : null,
    avatarUrl: typeof current.avatarUrl === "string" ? current.avatarUrl : null,
    scope: token.scope || (typeof current.scope === "string" ? current.scope : null),
    connectedAt: typeof current.connectedAt === "string" ? current.connectedAt : new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
  };
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { metadataJson },
  });
  return { accessToken: token.access_token, refreshToken: nextRefresh };
}

export async function getTikTokConnection(): Promise<TikTokConnection | null> {
  if (allowSharedEnv() && process.env.TIKTOK_ACCESS_TOKEN) {
    return {
      source: "env",
      accessToken: process.env.TIKTOK_ACCESS_TOKEN,
      refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
      openId: process.env.TIKTOK_OPEN_ID,
      displayName: process.env.TIKTOK_ACCOUNT_LABEL,
    };
  }

  if (!storageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand();
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "tiktok" } },
  });
  if (!row || row.status !== "connected" || !row.metadataJson || typeof row.metadataJson !== "object") return null;
  const meta = row.metadataJson as Record<string, unknown>;
  const encryptedAccess = typeof meta.accessToken === "string" ? meta.accessToken : undefined;
  if (!encryptedAccess) return null;

  let accessToken = decryptIntegrationSecret(encryptedAccess);
  const encryptedRefresh = typeof meta.refreshToken === "string" ? meta.refreshToken : undefined;
  let refreshToken = encryptedRefresh ? decryptIntegrationSecret(encryptedRefresh) : undefined;
  const expiresAt = typeof meta.expiresAt === "string" ? meta.expiresAt : undefined;

  if (expiresAt && refreshToken && new Date(expiresAt).getTime() < Date.now() + 60_000) {
    const refreshed = await refreshDatabaseToken(row.id, refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
  }

  return {
    source: "database",
    accessToken,
    refreshToken,
    expiresAt,
    openId: typeof meta.openId === "string" ? meta.openId : undefined,
    displayName: typeof meta.displayName === "string" ? meta.displayName : undefined,
    avatarUrl: typeof meta.avatarUrl === "string" ? meta.avatarUrl : undefined,
  };
}

export async function queryTikTokCreatorInfo(): Promise<TikTokCreatorInfo> {
  const connection = await getTikTokConnection();
  if (!connection) throw new Error("TIKTOK_NOT_CONNECTED");

  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    data?: {
      creator_avatar_url?: string;
      creator_username?: string;
      creator_nickname?: string;
      privacy_level_options?: TikTokPrivacyLevel[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
    };
    error?: { code?: string; message?: string; log_id?: string };
  };
  if (!response.ok || body.error?.code && body.error.code !== "ok") {
    throw new Error(body.error?.message || `TikTok creator info failed (${response.status})`);
  }
  const data = body.data || {};
  return {
    creatorAvatarUrl: data.creator_avatar_url,
    creatorUsername: data.creator_username,
    creatorNickname: data.creator_nickname,
    privacyLevelOptions: data.privacy_level_options || [],
    commentDisabled: data.comment_disabled,
    duetDisabled: data.duet_disabled,
    stitchDisabled: data.stitch_disabled,
    maxVideoPostDurationSec: data.max_video_post_duration_sec,
  };
}

function buildTitle(input: { caption: string; hashtags?: string; cta?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.hashtags?.trim()].filter(Boolean).join("\n\n").slice(0, 2200);
}

export async function publishTikTok(input: {
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  contentType: string;
  privacyLevel?: TikTokPrivacyLevel;
}) {
  const connection = await getTikTokConnection();
  if (!connection) throw new Error("TIKTOK_NOT_CONNECTED");
  if (!input.mediaUrl) throw new Error("TIKTOK_MEDIA_REQUIRED");
  if (!["reel", "video", "short"].includes(input.contentType)) throw new Error("TIKTOK_FORMAT_NOT_READY");
  if (!input.privacyLevel) throw new Error("TIKTOK_PRIVACY_REQUIRED");

  const creator = await queryTikTokCreatorInfo();
  if (!creator.privacyLevelOptions.includes(input.privacyLevel)) {
    throw new Error("TIKTOK_PRIVACY_NOT_ALLOWED");
  }

  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: buildTitle(input),
        privacy_level: input.privacyLevel,
        disable_duet: Boolean(creator.duetDisabled),
        disable_comment: Boolean(creator.commentDisabled),
        disable_stitch: Boolean(creator.stitchDisabled),
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: input.mediaUrl,
      },
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string; log_id?: string };
  };
  if (!response.ok || body.error?.code && body.error.code !== "ok" || !body.data?.publish_id) {
    throw new Error(body.error?.message || body.error?.code || `TikTok publish init failed (${response.status})`);
  }
  return { publishId: body.data.publish_id };
}
