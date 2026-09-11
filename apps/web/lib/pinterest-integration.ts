import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

type PinterestTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  refresh_token_expires_at?: number;
  scope?: string;
  token_type?: string;
};

type PinterestUser = {
  username?: string;
  account_type?: string;
  profile_image?: string;
  website_url?: string;
};

export type PinterestBoard = {
  id: string;
  name: string;
  privacy?: string;
};

export type PinterestConnection = {
  source: "env" | "database";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  username?: string;
  profileImage?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function storageReady() {
  return usePostgres() && canEncryptIntegrations();
}

function appConfigured() {
  return Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET);
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

export function getPinterestSetupState() {
  return { appConfigured: appConfigured(), storageReady: storageReady() };
}

export function buildPinterestOAuthUrl(redirectUri: string, state: string) {
  if (!process.env.PINTEREST_APP_ID) throw new Error("PINTEREST_APP_ID_REQUIRED");
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", process.env.PINTEREST_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "boards:read,pins:read,pins:write,user_accounts:read");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(fields: Record<string, string>) {
  if (!process.env.PINTEREST_APP_ID || !process.env.PINTEREST_APP_SECRET) {
    throw new Error("PINTEREST_APP_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Partial<PinterestTokenResponse> & {
    code?: number;
    message?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.message || `Pinterest token request failed (${response.status})`);
  }
  return body as PinterestTokenResponse;
}

async function fetchPinterestUser(accessToken: string) {
  const response = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as PinterestUser & { message?: string };
  if (!response.ok) throw new Error(body.message || `Pinterest account lookup failed (${response.status})`);
  return body;
}

export async function exchangePinterestCode(code: string, redirectUri: string) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    continuous_refresh: "true",
  });
  const user = await fetchPinterestUser(token.access_token);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    refreshTokenExpiresIn: token.refresh_token_expires_in,
    refreshTokenExpiresAt: token.refresh_token_expires_at,
    scope: token.scope,
    user,
  };
}

export async function savePinterestConnection(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
  refreshTokenExpiresAt?: number;
  scope?: string;
  user: PinterestUser;
}) {
  if (!storageReady()) throw new Error("PINTEREST_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();
  const username = input.user.username || "Pinterest";

  const metadataJson = {
    accessToken: encryptIntegrationSecret(input.accessToken),
    refreshToken: input.refreshToken ? encryptIntegrationSecret(input.refreshToken) : null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    refreshTokenExpiresAt: input.refreshTokenExpiresAt
      ? new Date(input.refreshTokenExpiresAt * 1000).toISOString()
      : input.refreshTokenExpiresIn
        ? new Date(Date.now() + input.refreshTokenExpiresIn * 1000).toISOString()
        : null,
    scope: input.scope || null,
    username,
    profileImage: input.user.profile_image || null,
    websiteUrl: input.user.website_url || null,
    accountType: input.user.account_type || null,
    connectedAt: new Date().toISOString(),
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "pinterest" } },
    create: {
      brandId: brand.id,
      provider: "pinterest",
      externalAccountId: username,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId: username,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectPinterestConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "pinterest" } });
}

async function refreshDatabaseToken(connectionId: string, refreshToken: string) {
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "boards:read,pins:read,pins:write,user_accounts:read",
  });
  const prisma = getPrisma();
  const row = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!row?.metadataJson || typeof row.metadataJson !== "object") throw new Error("PINTEREST_CONNECTION_NOT_FOUND");
  const current = row.metadataJson as Record<string, unknown>;
  const nextRefresh = token.refresh_token || refreshToken;
  const metadataJson = {
    accessToken: encryptIntegrationSecret(token.access_token),
    refreshToken: encryptIntegrationSecret(nextRefresh),
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    refreshTokenExpiresAt: token.refresh_token_expires_at
      ? new Date(token.refresh_token_expires_at * 1000).toISOString()
      : token.refresh_token_expires_in
        ? new Date(Date.now() + token.refresh_token_expires_in * 1000).toISOString()
        : (typeof current.refreshTokenExpiresAt === "string" ? current.refreshTokenExpiresAt : null),
    scope: token.scope || (typeof current.scope === "string" ? current.scope : null),
    username: typeof current.username === "string" ? current.username : null,
    profileImage: typeof current.profileImage === "string" ? current.profileImage : null,
    websiteUrl: typeof current.websiteUrl === "string" ? current.websiteUrl : null,
    accountType: typeof current.accountType === "string" ? current.accountType : null,
    connectedAt: typeof current.connectedAt === "string" ? current.connectedAt : new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
  };

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { metadataJson },
  });
  return { accessToken: token.access_token, refreshToken: nextRefresh };
}

export async function getPinterestConnection(brandId?: string): Promise<PinterestConnection | null> {
  if (allowSharedEnv() && process.env.PINTEREST_ACCESS_TOKEN) {
    return {
      source: "env",
      accessToken: process.env.PINTEREST_ACCESS_TOKEN,
      refreshToken: process.env.PINTEREST_REFRESH_TOKEN,
      username: process.env.PINTEREST_USERNAME,
    };
  }

  if (!storageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand(brandId);
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "pinterest" } },
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
    username: typeof meta.username === "string" ? meta.username : undefined,
    profileImage: typeof meta.profileImage === "string" ? meta.profileImage : undefined,
  };
}

export async function listPinterestBoards(brandId?: string): Promise<PinterestBoard[]> {
  const connection = await getPinterestConnection(brandId);
  if (!connection) throw new Error("PINTEREST_NOT_CONNECTED");

  const url = new URL("https://api.pinterest.com/v5/boards");
  url.searchParams.set("page_size", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    items?: PinterestBoard[];
    message?: string;
  };
  if (!response.ok) throw new Error(body.message || `Pinterest boards lookup failed (${response.status})`);
  return (body.items || []).filter((board) => Boolean(board.id && board.name));
}

function pinDescription(input: { caption: string; hashtags?: string; cta?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.hashtags?.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 800);
}

export async function publishPinterest(input: {
  title: string;
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  altText?: string;
  contentType: string;
  boardId?: string;
}, brandId?: string) {
  const connection = await getPinterestConnection(brandId);
  if (!connection) throw new Error("PINTEREST_NOT_CONNECTED");
  if (!input.boardId) throw new Error("PINTEREST_BOARD_REQUIRED");
  if (!input.mediaUrl) throw new Error("PINTEREST_MEDIA_REQUIRED");
  if (["video", "reel", "short", "story", "carousel"].includes(input.contentType)) {
    throw new Error("PINTEREST_VIDEO_UPLOAD_NOT_READY");
  }

  const response = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: input.boardId,
      title: input.title.slice(0, 100),
      description: pinDescription(input),
      ...(input.linkUrl ? { link: input.linkUrl } : {}),
      ...(input.altText ? { alt_text: input.altText.slice(0, 500) } : {}),
      media_source: {
        source_type: "image_url",
        url: input.mediaUrl,
        is_standard: true,
      },
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    id?: string;
    board_id?: string;
    message?: string;
    code?: number;
  };
  if (!response.ok || !body.id) {
    throw new Error(body.message || `Pinterest Pin creation failed (${response.status})`);
  }
  return { pinId: body.id, boardId: body.board_id || input.boardId };
}


function pinterestMetric(metrics: Record<string, unknown> | undefined, keys: string[]) {
  if (!metrics) return undefined;
  for (const key of keys) {
    const raw = metrics[key];
    if (typeof raw === "number") return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  }
  return undefined;
}

function pinterestPinMetrics(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const root = value as Record<string, unknown>;
  const candidate =
    (root.lifetime_metrics && typeof root.lifetime_metrics === "object" ? root.lifetime_metrics : undefined) ||
    (root["90d"] && typeof root["90d"] === "object" ? root["90d"] : undefined) ||
    (root.ninety_day_metrics && typeof root.ninety_day_metrics === "object" ? root.ninety_day_metrics : undefined) ||
    root;
  return candidate as Record<string, unknown>;
}

export async function fetchPinterestAnalytics() {
  const connection = await getPinterestConnection();
  if (!connection) throw new Error("PINTEREST_NOT_CONNECTED");

  const pinsUrl = new URL("https://api.pinterest.com/v5/pins");
  pinsUrl.searchParams.set("page_size", "25");
  pinsUrl.searchParams.set("pin_metrics", "true");

  const response = await fetch(pinsUrl, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    items?: Array<{
      id: string;
      title?: string;
      description?: string;
      link?: string;
      pin_metrics?: unknown;
    }>;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(body.message || `Pinterest analytics failed (${response.status})`);
  }

  const pins = (body.items || []).map((pin) => {
    const metrics = pinterestPinMetrics(pin.pin_metrics);
    return {
      id: pin.id,
      title: pin.title || pin.description?.slice(0, 90) || "Pinterest Pin",
      url: `https://www.pinterest.com/pin/${pin.id}/`,
      impressions: pinterestMetric(metrics, ["IMPRESSION", "impression", "impressions"]),
      engagements: pinterestMetric(metrics, ["ENGAGEMENT", "engagement", "engagements"]),
      saves: pinterestMetric(metrics, ["SAVE", "save", "saves"]),
      clicks: pinterestMetric(metrics, ["PIN_CLICK", "pin_click", "pin_clicks"]),
      outboundClicks: pinterestMetric(metrics, ["OUTBOUND_CLICK", "outbound_click", "outbound_clicks"]),
    };
  });

  const sum = (key: "impressions" | "engagements" | "saves") =>
    pins.reduce((total, item) => total + (typeof item[key] === "number" ? item[key] as number : 0), 0);

  return {
    accountLabel: connection.username ? `@${connection.username}` : "Pinterest",
    posts: pins.length,
    impressions: sum("impressions"),
    engagements: sum("engagements"),
    saves: sum("saves"),
    pins,
  };
}
