import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type YouTubeChannel = {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
};

export type YouTubePrivacyStatus = "public" | "private" | "unlisted";

export type YouTubeConnection = {
  source: "env" | "database";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  channelId?: string;
  channelTitle?: string;
  channelCustomUrl?: string;
  thumbnailUrl?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function storageReady() {
  return usePostgres() && canEncryptIntegrations();
}

function appConfigured() {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
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

export function getYouTubeSetupState() {
  return { appConfigured: appConfigured(), storageReady: storageReady() };
}

export function buildYouTubeOAuthUrl(redirectUri: string, state: string) {
  if (!process.env.YOUTUBE_CLIENT_ID) throw new Error("YOUTUBE_CLIENT_ID_REQUIRED");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.YOUTUBE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(fields: Record<string, string>) {
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    throw new Error("YOUTUBE_APP_NOT_CONFIGURED");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      ...fields,
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Partial<GoogleTokenResponse> & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `YouTube token request failed (${response.status})`);
  }
  return body as GoogleTokenResponse;
}

async function fetchChannel(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    items?: YouTubeChannel[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.message || `YouTube channel lookup failed (${response.status})`);
  }
  const channel = body.items?.[0];
  if (!channel?.id) throw new Error("YOUTUBE_CHANNEL_NOT_FOUND");
  return channel;
}

export async function exchangeYouTubeCode(code: string, redirectUri: string) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const channel = await fetchChannel(token.access_token);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    scope: token.scope,
    channel,
  };
}

export async function saveYouTubeConnection(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  channel: YouTubeChannel;
}) {
  if (!storageReady()) throw new Error("YOUTUBE_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();

  const metadataJson = {
    accessToken: encryptIntegrationSecret(input.accessToken),
    refreshToken: input.refreshToken ? encryptIntegrationSecret(input.refreshToken) : null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    scope: input.scope || null,
    channelId: input.channel.id,
    channelTitle: input.channel.snippet?.title || "YouTube channel",
    channelCustomUrl: input.channel.snippet?.customUrl || null,
    thumbnailUrl: input.channel.snippet?.thumbnails?.medium?.url || input.channel.snippet?.thumbnails?.default?.url || null,
    connectedAt: new Date().toISOString(),
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "youtube" } },
    create: {
      brandId: brand.id,
      provider: "youtube",
      externalAccountId: input.channel.id,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId: input.channel.id,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectYouTubeConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "youtube" } });
}

async function refreshDatabaseToken(connectionId: string, refreshToken: string) {
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const prisma = getPrisma();
  const row = await prisma.integrationConnection.findUnique({ where: { id: connectionId } });
  if (!row?.metadataJson || typeof row.metadataJson !== "object") throw new Error("YOUTUBE_CONNECTION_NOT_FOUND");
  const current = row.metadataJson as Record<string, unknown>;

  const metadataJson = {
    accessToken: encryptIntegrationSecret(token.access_token),
    refreshToken: encryptIntegrationSecret(token.refresh_token || refreshToken),
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    scope: token.scope || (typeof current.scope === "string" ? current.scope : null),
    channelId: typeof current.channelId === "string" ? current.channelId : null,
    channelTitle: typeof current.channelTitle === "string" ? current.channelTitle : null,
    channelCustomUrl: typeof current.channelCustomUrl === "string" ? current.channelCustomUrl : null,
    thumbnailUrl: typeof current.thumbnailUrl === "string" ? current.thumbnailUrl : null,
    connectedAt: typeof current.connectedAt === "string" ? current.connectedAt : new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
  };

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { metadataJson },
  });

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
  };
}

export async function getYouTubeConnection(brandId?: string): Promise<YouTubeConnection | null> {
  if (allowSharedEnv() && process.env.YOUTUBE_ACCESS_TOKEN) {
    return {
      source: "env",
      accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
      channelId: process.env.YOUTUBE_CHANNEL_ID,
      channelTitle: process.env.YOUTUBE_CHANNEL_TITLE,
    };
  }

  if (!storageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand(brandId);
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "youtube" } },
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
    channelId: typeof meta.channelId === "string" ? meta.channelId : undefined,
    channelTitle: typeof meta.channelTitle === "string" ? meta.channelTitle : undefined,
    channelCustomUrl: typeof meta.channelCustomUrl === "string" ? meta.channelCustomUrl : undefined,
    thumbnailUrl: typeof meta.thumbnailUrl === "string" ? meta.thumbnailUrl : undefined,
  };
}

function tagsFromHashtags(hashtags?: string) {
  if (!hashtags) return [];
  return hashtags
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function descriptionFromInput(input: { caption: string; cta?: string; linkUrl?: string; hashtags?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.linkUrl?.trim(), input.hashtags?.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 5000);
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export async function publishYouTube(input: {
  title: string;
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  contentType: string;
  privacyStatus?: YouTubePrivacyStatus;
  madeForKids?: boolean;
}, brandId?: string) {
  const connection = await getYouTubeConnection(brandId);
  if (!connection) throw new Error("YOUTUBE_NOT_CONNECTED");
  if (!input.mediaUrl) throw new Error("YOUTUBE_MEDIA_REQUIRED");
  if (!["video", "short", "reel"].includes(input.contentType)) throw new Error("YOUTUBE_FORMAT_NOT_READY");
  if (!input.privacyStatus) throw new Error("YOUTUBE_PRIVACY_REQUIRED");

  const source = await fetch(input.mediaUrl, { cache: "no-store" });
  if (!source.ok) throw new Error(`YOUTUBE_MEDIA_FETCH_FAILED_${source.status}`);

  const contentType = source.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
    throw new Error("YOUTUBE_MEDIA_NOT_VIDEO");
  }

  const contentLength = Number(source.headers.get("content-length") || "0");
  const maxBytes = Number(process.env.YOUTUBE_MAX_SERVER_UPLOAD_BYTES || DEFAULT_MAX_BYTES);
  if (contentLength && contentLength > maxBytes) throw new Error("YOUTUBE_MEDIA_TOO_LARGE_FOR_SERVER_TRANSFER");

  const bytes = await source.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("YOUTUBE_MEDIA_TOO_LARGE_FOR_SERVER_TRANSFER");

  const initUrl = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  initUrl.searchParams.set("uploadType", "resumable");
  initUrl.searchParams.set("part", "snippet,status");
  initUrl.searchParams.set("notifySubscribers", "false");

  const metadata = {
    snippet: {
      title: input.title.slice(0, 100),
      description: descriptionFromInput(input),
      tags: tagsFromHashtags(input.hashtags),
      categoryId: process.env.YOUTUBE_DEFAULT_CATEGORY_ID || "22",
    },
    status: {
      privacyStatus: input.privacyStatus,
      selfDeclaredMadeForKids: Boolean(input.madeForKids),
    },
  };

  const initResponse = await fetch(initUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": contentType,
      "X-Upload-Content-Length": String(bytes.byteLength),
    },
    body: JSON.stringify(metadata),
    cache: "no-store",
  });

  if (!initResponse.ok) {
    const body = await initResponse.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body.error?.message || `YouTube upload session failed (${initResponse.status})`);
  }

  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) throw new Error("YOUTUBE_UPLOAD_SESSION_MISSING");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
    cache: "no-store",
  });
  const body = await uploadResponse.json().catch(() => ({})) as {
    id?: string;
    status?: { uploadStatus?: string; privacyStatus?: string };
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !body.id) {
    throw new Error(body.error?.message || `YouTube upload failed (${uploadResponse.status})`);
  }

  return {
    videoId: body.id,
    uploadStatus: body.status?.uploadStatus || "uploaded",
    privacyStatus: body.status?.privacyStatus || input.privacyStatus,
  };
}

export async function getYouTubeVideoStatus(videoId: string, brandId?: string) {
  const connection = await getYouTubeConnection(brandId);
  if (!connection) throw new Error("YOUTUBE_NOT_CONNECTED");

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status,processingDetails");
  url.searchParams.set("id", videoId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    items?: Array<{
      id?: string;
      status?: {
        uploadStatus?: string;
        failureReason?: string;
        rejectionReason?: string;
        privacyStatus?: string;
      };
      processingDetails?: {
        processingStatus?: string;
        processingProgress?: { partsTotal?: string; partsProcessed?: string };
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message || `YouTube status lookup failed (${response.status})`);
  }

  const video = body.items?.[0];
  if (!video?.id) throw new Error("YOUTUBE_VIDEO_NOT_FOUND");

  return {
    videoId: video.id,
    uploadStatus: video.status?.uploadStatus || "uploaded",
    failureReason: video.status?.failureReason,
    rejectionReason: video.status?.rejectionReason,
    privacyStatus: video.status?.privacyStatus,
    processingStatus: video.processingDetails?.processingStatus,
    partsTotal: video.processingDetails?.processingProgress?.partsTotal,
    partsProcessed: video.processingDetails?.processingProgress?.partsProcessed,
  };
}


export async function fetchYouTubeAnalytics() {
  const connection = await getYouTubeConnection();
  if (!connection) throw new Error("YOUTUBE_NOT_CONNECTED");

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  channelUrl.searchParams.set("mine", "true");

  const channelResponse = await fetch(channelUrl, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  const channelBody = await channelResponse.json().catch(() => ({})) as {
    items?: Array<{
      id: string;
      snippet?: { title?: string };
      statistics?: {
        viewCount?: string;
        subscriberCount?: string;
        videoCount?: string;
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
    error?: { message?: string };
  };
  if (!channelResponse.ok) {
    throw new Error(channelBody.error?.message || `YouTube analytics failed (${channelResponse.status})`);
  }

  const channel = channelBody.items?.[0];
  if (!channel?.id) throw new Error("YOUTUBE_CHANNEL_NOT_FOUND");
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;

  let videos: Array<{
    id: string;
    title: string;
    url: string;
    views: number;
    likes: number;
    comments: number;
  }> = [];

  if (uploads) {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "contentDetails");
    playlistUrl.searchParams.set("playlistId", uploads);
    playlistUrl.searchParams.set("maxResults", "12");

    const playlistResponse = await fetch(playlistUrl, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
      cache: "no-store",
    });
    const playlistBody = await playlistResponse.json().catch(() => ({})) as {
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    };
    const ids = (playlistBody.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean) as string[];

    if (ids.length) {
      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.searchParams.set("part", "snippet,statistics");
      videosUrl.searchParams.set("id", ids.join(","));
      const videosResponse = await fetch(videosUrl, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
        cache: "no-store",
      });
      const videosBody = await videosResponse.json().catch(() => ({})) as {
        items?: Array<{
          id: string;
          snippet?: { title?: string };
          statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
        }>;
      };
      videos = (videosBody.items || []).map((video) => ({
        id: video.id,
        title: video.snippet?.title || "YouTube video",
        url: `https://www.youtube.com/watch?v=${video.id}`,
        views: Number(video.statistics?.viewCount || 0),
        likes: Number(video.statistics?.likeCount || 0),
        comments: Number(video.statistics?.commentCount || 0),
      }));
    }
  }

  return {
    accountLabel: channel.snippet?.title || connection.channelTitle || "YouTube",
    followers: Number(channel.statistics?.subscriberCount || 0),
    views: Number(channel.statistics?.viewCount || 0),
    posts: Number(channel.statistics?.videoCount || 0),
    videos,
  };
}
