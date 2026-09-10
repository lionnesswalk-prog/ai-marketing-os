import { getPrisma } from "./prisma";
import { getSession } from "./auth";
import { canEncryptIntegrations, decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-crypto";

const apiVersion = process.env.LINKEDIN_API_VERSION || "202608";

type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  scope?: string;
};

type LinkedInUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
};

export type LinkedInConnection = {
  source: "env" | "database";
  accessToken: string;
  authorUrn: string;
  accountLabel?: string;
  profileUrl?: string;
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function appConfigured() {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

function storageReady() {
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

export function getLinkedInSetupState() {
  return {
    appConfigured: appConfigured(),
    storageReady: storageReady(),
    apiVersion,
  };
}

function scopes() {
  const values = ["openid", "profile", "email", "w_member_social"];
  if (process.env.LINKEDIN_REQUEST_ORGANIZATION_SCOPE === "true") values.push("w_organization_social");
  return values;
}

export function buildLinkedInOAuthUrl(redirectUri: string, state: string) {
  if (!process.env.LINKEDIN_CLIENT_ID) throw new Error("LINKEDIN_CLIENT_ID_REQUIRED");
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes().join(" "));
  return url.toString();
}

export async function exchangeLinkedInCode(code: string, redirectUri: string) {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    throw new Error("LINKEDIN_APP_NOT_CONFIGURED");
  }

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const token = await tokenResponse.json().catch(() => ({})) as Partial<LinkedInTokenResponse> & { error_description?: string };
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token.error_description || `LinkedIn token exchange failed (${tokenResponse.status})`);
  }

  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const profile = await profileResponse.json().catch(() => ({})) as Partial<LinkedInUserInfo>;
  if (!profileResponse.ok || !profile.sub) throw new Error("LINKEDIN_PROFILE_LOOKUP_FAILED");

  const configuredAuthor = process.env.LINKEDIN_ORGANIZATION_URN || process.env.LINKEDIN_AUTHOR_URN;
  const authorUrn = configuredAuthor || `urn:li:person:${profile.sub}`;
  return {
    accessToken: token.access_token,
    expiresIn: token.expires_in,
    scope: token.scope,
    authorUrn,
    profile,
  };
}

export async function saveLinkedInConnection(input: {
  accessToken: string;
  expiresIn?: number;
  scope?: string;
  authorUrn: string;
  profile: Partial<LinkedInUserInfo>;
}) {
  if (!storageReady()) throw new Error("LINKEDIN_STORAGE_NOT_READY");
  const prisma = getPrisma();
  const brand = await currentBrand();
  const name = input.profile.name || [input.profile.given_name, input.profile.family_name].filter(Boolean).join(" ") || "LinkedIn account";

  const metadataJson = {
    accessToken: encryptIntegrationSecret(input.accessToken),
    authorUrn: input.authorUrn,
    accountLabel: name,
    profileEmail: input.profile.email || null,
    profilePicture: input.profile.picture || null,
    scope: input.scope || null,
    expiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null,
    connectedAt: new Date().toISOString(),
    apiVersion,
  };

  return prisma.integrationConnection.upsert({
    where: { brandId_provider: { brandId: brand.id, provider: "linkedin" } },
    create: {
      brandId: brand.id,
      provider: "linkedin",
      externalAccountId: input.authorUrn,
      status: "connected",
      metadataJson,
    },
    update: {
      externalAccountId: input.authorUrn,
      status: "connected",
      metadataJson,
    },
  });
}

export async function disconnectLinkedInConnection() {
  if (!usePostgres()) return;
  const prisma = getPrisma();
  const brand = await currentBrand();
  await prisma.integrationConnection.deleteMany({ where: { brandId: brand.id, provider: "linkedin" } });
}

export async function getLinkedInConnection(): Promise<LinkedInConnection | null> {
  if (process.env.LINKEDIN_ACCESS_TOKEN && (process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_AUTHOR_ID)) {
    const rawAuthor = process.env.LINKEDIN_AUTHOR_URN || process.env.LINKEDIN_AUTHOR_ID || "";
    const authorUrn = rawAuthor.startsWith("urn:li:") ? rawAuthor : `urn:li:person:${rawAuthor}`;
    return {
      source: "env",
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
      authorUrn,
      accountLabel: process.env.LINKEDIN_ACCOUNT_LABEL || "LinkedIn",
    };
  }

  if (!storageReady()) return null;
  const prisma = getPrisma();
  const brand = await currentBrand();
  const row = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider: "linkedin" } },
  });
  if (!row || row.status !== "connected" || !row.metadataJson || typeof row.metadataJson !== "object") return null;

  const meta = row.metadataJson as Record<string, unknown>;
  const encryptedToken = typeof meta.accessToken === "string" ? meta.accessToken : undefined;
  const authorUrn = typeof meta.authorUrn === "string" ? meta.authorUrn : undefined;
  if (!encryptedToken || !authorUrn) return null;

  return {
    source: "database",
    accessToken: decryptIntegrationSecret(encryptedToken),
    authorUrn,
    accountLabel: typeof meta.accountLabel === "string" ? meta.accountLabel : "LinkedIn",
  };
}

function fullCommentary(input: { caption: string; hashtags?: string; cta?: string }) {
  return [input.caption.trim(), input.cta?.trim(), input.hashtags?.trim()].filter(Boolean).join("\n\n");
}

export async function publishLinkedIn(input: {
  title: string;
  caption: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  contentType: string;
}) {
  const connection = await getLinkedInConnection();
  if (!connection) throw new Error("LINKEDIN_NOT_CONNECTED");
  if (input.mediaUrl) throw new Error("LINKEDIN_MEDIA_UPLOAD_NOT_READY");
  if (["reel", "video", "short", "story", "carousel"].includes(input.contentType)) {
    throw new Error("LINKEDIN_FORMAT_NOT_READY");
  }

  const body: Record<string, unknown> = {
    author: connection.authorUrn,
    commentary: fullCommentary(input),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (input.linkUrl) {
    body.content = {
      article: {
        source: input.linkUrl,
        title: input.title,
        description: input.caption.slice(0, 256),
      },
    };
  }

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": apiVersion,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const responseText = await response.text();
  if (!response.ok) {
    let message = `LinkedIn publish failed (${response.status})`;
    try {
      const parsed = JSON.parse(responseText) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {}
    throw new Error(message);
  }

  return {
    id: response.headers.get("x-restli-id") || `linkedin_${Date.now()}`,
  };
}
