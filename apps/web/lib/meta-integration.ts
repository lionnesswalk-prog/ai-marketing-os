import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
const graphBase = `https://graph.facebook.com/${graphVersion}`;

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

export type MetaConnection = {
  source: "env" | "database";
  pageId?: string;
  pageName?: string;
  pageAccessToken?: string;
  instagramBusinessAccountId?: string;
  instagramUsername?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function metaAppConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function integrationStorageReady() {
  return usePostgres() && canEncryptIntegrations();
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

export function getMetaSetupState() {
  return {
    appConfigured: metaAppConfigured(),
    storageReady: integrationStorageReady(),
    graphVersion,
  };
}

function metaScopes() {
  return [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
  ];
}

export function buildMetaOAuthUrl(redirectUri: string, state: string) {
  if (!process.env.META_APP_ID) throw new Error("META_APP_ID_REQUIRED");
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", metaScopes().join(","));
  return url.toString();
}

async function graphJson<T>(url: URL | string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok || body.error) {
    const message = body.error?.message || `Meta API request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function exchangeMetaCode(code: string, redirectUri: string) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) throw new Error("META_APP_NOT_CONFIGURED");

  const tokenUrl = new URL(`${graphBase}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", process.env.META_APP_ID);
  tokenUrl.searchParams.set("client_secret", process.env.META_APP_SECRET);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const shortToken = await graphJson<{ access_token: string }>(tokenUrl);

  const longUrl = new URL(`${graphBase}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_APP_ID);
  longUrl.searchParams.set("client_secret", process.env.META_APP_SECRET);
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
  const longToken = await graphJson<{ access_token: string }>(longUrl);

  const pagesUrl = new URL(`${graphBase}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account{id,username,name}");
  pagesUrl.searchParams.set("access_token", longToken.access_token);
  const pages = await graphJson<{ data: MetaPage[] }>(pagesUrl);
  if (!pages.data?.length) throw new Error("NO_FACEBOOK_PAGE_FOUND");

  return { userAccessToken: longToken.access_token, pages: pages.data };
}

export async function saveMetaConnection(input: {
  userAccessToken: string;
  page: MetaPage;
}) {
  if (!integrationStorageReady()) throw new Error("META_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();

  const metadataJson = {
    pageId: input.page.id,
    pageName: input.page.name,
    pageAccessToken: encryptIntegrationSecret(input.page.access_token),
    userAccessToken: encryptIntegrationSecret(input.userAccessToken),
    instagramBusinessAccountId: input.page.instagram_business_account?.id || null,
    instagramUsername: input.page.instagram_business_account?.username || null,
    connectedAt: new Date().toISOString(),
    graphVersion,
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "meta" } },
    create: {
      brandId: brand.id,
      provider: "meta",
      externalAccountId: input.page.id,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId: input.page.id,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectMetaConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "meta" } });
}

export async function getMetaConnection(): Promise<MetaConnection | null> {
  const allowSharedEnv = !usePostgres() || process.env.ALLOW_SHARED_ENV_INTEGRATIONS === "true";
  const staticPageToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (allowSharedEnv && staticPageToken && (process.env.FACEBOOK_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID)) {
    return {
      source: "env",
      pageId: process.env.FACEBOOK_PAGE_ID,
      pageName: process.env.FACEBOOK_PAGE_NAME,
      pageAccessToken: staticPageToken,
      instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      instagramUsername: process.env.INSTAGRAM_USERNAME,
    };
  }

  if (!integrationStorageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand();
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "meta" } },
  });
  if (!row || row.status !== "connected" || !row.metadataJson || typeof row.metadataJson !== "object") return null;

  const meta = row.metadataJson as Record<string, unknown>;
  const encryptedPageToken = typeof meta.pageAccessToken === "string" ? meta.pageAccessToken : undefined;
  if (!encryptedPageToken) return null;

  return {
    source: "database",
    pageId: typeof meta.pageId === "string" ? meta.pageId : undefined,
    pageName: typeof meta.pageName === "string" ? meta.pageName : undefined,
    pageAccessToken: decryptIntegrationSecret(encryptedPageToken),
    instagramBusinessAccountId: typeof meta.instagramBusinessAccountId === "string" ? meta.instagramBusinessAccountId : undefined,
    instagramUsername: typeof meta.instagramUsername === "string" ? meta.instagramUsername : undefined,
  };
}

function fullCaption(input: { caption: string; hashtags?: string; cta?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.hashtags?.trim()].filter(Boolean).join("\n\n");
}

async function postForm<T>(url: string, fields: Record<string, string>) {
  return graphJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

export async function publishFacebook(input: {
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  contentType: string;
}) {
  const connection = await getMetaConnection();
  if (!connection?.pageId || !connection.pageAccessToken) throw new Error("FACEBOOK_NOT_CONNECTED");
  if (["reel", "video", "short", "carousel", "story"].includes(input.contentType)) {
    throw new Error("FACEBOOK_FORMAT_NOT_READY");
  }

  const message = fullCaption(input);
  if (input.mediaUrl) {
    return postForm<{ id: string; post_id?: string }>(`${graphBase}/${connection.pageId}/photos`, {
      url: input.mediaUrl,
      caption: message,
      access_token: connection.pageAccessToken,
    });
  }

  return postForm<{ id: string }>(`${graphBase}/${connection.pageId}/feed`, {
    message,
    ...(input.linkUrl ? { link: input.linkUrl } : {}),
    access_token: connection.pageAccessToken,
  });
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const statusUrl = new URL(`${graphBase}/${containerId}`);
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", accessToken);
    const status = await graphJson<{ status_code?: string; status?: string }>(statusUrl);
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(status.status || "Instagram media processing failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("INSTAGRAM_MEDIA_STILL_PROCESSING");
}

export async function publishInstagram(input: {
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  contentType: string;
}) {
  const connection = await getMetaConnection();
  if (!connection?.instagramBusinessAccountId || !connection.pageAccessToken) throw new Error("INSTAGRAM_NOT_CONNECTED");
  if (!input.mediaUrl) throw new Error("INSTAGRAM_MEDIA_REQUIRED");
  if (["carousel", "story"].includes(input.contentType)) throw new Error("INSTAGRAM_FORMAT_NOT_READY");

  const caption = fullCaption(input);
  const isVideo = ["reel", "video", "short"].includes(input.contentType);
  const createFields: Record<string, string> = {
    caption,
    access_token: connection.pageAccessToken,
  };
  if (isVideo) {
    createFields.media_type = "REELS";
    createFields.video_url = input.mediaUrl;
  } else {
    createFields.image_url = input.mediaUrl;
  }

  const container = await postForm<{ id: string }>(`${graphBase}/${connection.instagramBusinessAccountId}/media`, createFields);
  if (isVideo) await waitForInstagramContainer(container.id, connection.pageAccessToken);
  return postForm<{ id: string }>(`${graphBase}/${connection.instagramBusinessAccountId}/media_publish`, {
    creation_id: container.id,
    access_token: connection.pageAccessToken,
  });
}
