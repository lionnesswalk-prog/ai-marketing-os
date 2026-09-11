import { getMetaConnection } from "./meta-integration";
import { getLinkedInConnection } from "./linkedin-integration";
import { getXConnection } from "./x-integration";
import { getTikTokConnection, queryTikTokCreatorInfo } from "./tiktok-integration";
import { getYouTubeConnection } from "./youtube-integration";
import { getPinterestConnection, listPinterestBoards } from "./pinterest-integration";

export type ProviderDiagnostic = {
  id: "meta" | "linkedin" | "x" | "tiktok" | "youtube" | "pinterest";
  name: string;
  status: "ready" | "disconnected" | "error";
  detail: string;
  checkedAt: string;
  latencyMs: number;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PROVIDER_DIAGNOSTIC_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function providerDiagnosticErrorDetail(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "PROVIDER_DIAGNOSTIC_TIMEOUT") {
    return "Provider API did not respond within 10 seconds.";
  }
  return "Provider API rejected or could not verify the saved connection. Reconnect the account or review provider permissions.";
}

async function probe(
  id: ProviderDiagnostic["id"],
  name: string,
  check: () => Promise<{ connected: boolean; detail?: string }>,
): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  try {
    const result = await withTimeout(check());
    return {
      id,
      name,
      status: result.connected ? "ready" : "disconnected",
      detail: result.detail || (result.connected ? "Live provider check passed." : "No connected account is stored for this workspace."),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id,
      name,
      status: "error",
      detail: providerDiagnosticErrorDetail(error),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function metaCheck() {
  const connection = await getMetaConnection();
  if (!connection?.pageAccessToken) return { connected: false };
  const objectId = connection.pageId || connection.instagramBusinessAccountId;
  if (!objectId) return { connected: false };
  const version = process.env.META_GRAPH_VERSION || "v26.0";
  const url = new URL(`https://graph.facebook.com/${version}/${objectId}`);
  url.searchParams.set("fields", "id,name,username");
  url.searchParams.set("access_token", connection.pageAccessToken);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("META_PROBE_FAILED");
  const body = await response.json().catch(() => ({})) as { name?: string; username?: string };
  return { connected: true, detail: body.username ? `@${body.username} verified by Meta.` : body.name ? `${body.name} verified by Meta.` : "Meta token verified." };
}

async function linkedInCheck() {
  const connection = await getLinkedInConnection();
  if (!connection?.accessToken) return { connected: false };
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("LINKEDIN_PROBE_FAILED");
  const body = await response.json().catch(() => ({})) as { name?: string };
  return { connected: true, detail: body.name ? `${body.name} verified by LinkedIn.` : "LinkedIn token verified." };
}

async function xCheck() {
  const connection = await getXConnection();
  if (!connection?.accessToken) return { connected: false };
  const response = await fetch("https://api.x.com/2/users/me?user.fields=name,username", {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("X_PROBE_FAILED");
  const body = await response.json().catch(() => ({})) as { data?: { username?: string; name?: string } };
  return { connected: true, detail: body.data?.username ? `@${body.data.username} verified by X.` : body.data?.name ? `${body.data.name} verified by X.` : "X token verified." };
}

async function tikTokCheck() {
  const connection = await getTikTokConnection();
  if (!connection?.accessToken) return { connected: false };
  const creator = await queryTikTokCreatorInfo();
  return {
    connected: true,
    detail: creator.creatorUsername ? `@${creator.creatorUsername} verified by TikTok.` : creator.creatorNickname ? `${creator.creatorNickname} verified by TikTok.` : "TikTok token verified.",
  };
}

async function youTubeCheck() {
  const connection = await getYouTubeConnection();
  if (!connection?.accessToken) return { connected: false };
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("YOUTUBE_PROBE_FAILED");
  const body = await response.json().catch(() => ({})) as { items?: Array<{ snippet?: { title?: string } }> };
  const channel = body.items?.[0];
  if (!channel) throw new Error("YOUTUBE_CHANNEL_NOT_FOUND");
  return { connected: true, detail: channel.snippet?.title ? `${channel.snippet.title} verified by YouTube.` : "YouTube token verified." };
}

async function pinterestCheck() {
  const connection = await getPinterestConnection();
  if (!connection?.accessToken) return { connected: false };
  const boards = await listPinterestBoards();
  return { connected: true, detail: `Pinterest token verified · ${boards.length} board${boards.length === 1 ? "" : "s"} accessible.` };
}

export async function runProviderDiagnostics() {
  return Promise.all([
    probe("meta", "Meta · Facebook & Instagram", metaCheck),
    probe("linkedin", "LinkedIn", linkedInCheck),
    probe("x", "X", xCheck),
    probe("tiktok", "TikTok", tikTokCheck),
    probe("youtube", "YouTube", youTubeCheck),
    probe("pinterest", "Pinterest", pinterestCheck),
  ]);
}
