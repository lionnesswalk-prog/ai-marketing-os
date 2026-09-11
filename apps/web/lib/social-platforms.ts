import type { SocialPlatform } from "./domain";
import { getMetaConnection, getMetaSetupState } from "./meta-integration";
import { getLinkedInConnection, getLinkedInSetupState } from "./linkedin-integration";
import { getXConnection, getXSetupState } from "./x-integration";
import { getTikTokConnection, getTikTokSetupState } from "./tiktok-integration";
import { getYouTubeConnection, getYouTubeSetupState } from "./youtube-integration";
import { getPinterestConnection, getPinterestSetupState } from "./pinterest-integration";

export type SocialPlatformConfig = {
  id: SocialPlatform;
  name: string;
  short: string;
  homeUrl: string;
  connected: boolean;
  accountLabel?: string;
  connectUrl?: string;
  disconnectUrl?: string;
  setupReady?: boolean;
  connectionCheckFailed?: boolean;
};

export async function getSocialPlatforms(): Promise<SocialPlatformConfig[]> {
  const [metaResult, linkedinResult, xResult, tiktokResult, youtubeResult, pinterestResult] = await Promise.allSettled([
    getMetaConnection(),
    getLinkedInConnection(),
    getXConnection(),
    getTikTokConnection(),
    getYouTubeConnection(),
    getPinterestConnection(),
  ]);
  const meta = metaResult.status === "fulfilled" ? metaResult.value : null;
  const linkedin = linkedinResult.status === "fulfilled" ? linkedinResult.value : null;
  const x = xResult.status === "fulfilled" ? xResult.value : null;
  const tiktok = tiktokResult.status === "fulfilled" ? tiktokResult.value : null;
  const youtube = youtubeResult.status === "fulfilled" ? youtubeResult.value : null;
  const pinterest = pinterestResult.status === "fulfilled" ? pinterestResult.value : null;
  const metaSetup = getMetaSetupState();
  const linkedinSetup = getLinkedInSetupState();
  const xSetup = getXSetupState();
  const tiktokSetup = getTikTokSetupState();
  const youtubeSetup = getYouTubeSetupState();
  const pinterestSetup = getPinterestSetupState();
  const instagramConnected = Boolean(meta?.instagramBusinessAccountId && meta.pageAccessToken);
  const facebookConnected = Boolean(meta?.pageId && meta.pageAccessToken);
  const linkedinConnected = Boolean(linkedin?.accessToken && linkedin.authorUrn);
  const xConnected = Boolean(x?.accessToken);
  const tiktokConnected = Boolean(tiktok?.accessToken);
  const youtubeConnected = Boolean(youtube?.accessToken);
  const pinterestConnected = Boolean(pinterest?.accessToken);

  return [
    {
      id: "instagram",
      name: "Instagram",
      short: "IG",
      homeUrl: meta?.instagramUsername ? `https://www.instagram.com/${meta.instagramUsername}/` : "https://www.instagram.com/",
      connected: instagramConnected,
      accountLabel: instagramConnected ? `@${meta?.instagramUsername || "professional account"}` : undefined,
      connectUrl: "/api/integrations/meta/connect",
      disconnectUrl: instagramConnected ? "/api/integrations/meta/disconnect" : undefined,
      setupReady: metaSetup.appConfigured && metaSetup.storageReady,
      connectionCheckFailed: metaResult.status === "rejected",
    },
    {
      id: "facebook",
      name: "Facebook",
      short: "FB",
      homeUrl: meta?.pageId ? `https://www.facebook.com/${meta.pageId}` : "https://www.facebook.com/",
      connected: facebookConnected,
      accountLabel: facebookConnected ? (meta?.pageName || "Facebook Page") : undefined,
      connectUrl: "/api/integrations/meta/connect",
      disconnectUrl: facebookConnected ? "/api/integrations/meta/disconnect" : undefined,
      setupReady: metaSetup.appConfigured && metaSetup.storageReady,
      connectionCheckFailed: metaResult.status === "rejected",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      short: "in",
      homeUrl: linkedin?.profileUrl || "https://www.linkedin.com/",
      connected: linkedinConnected,
      accountLabel: linkedinConnected ? (linkedin?.accountLabel || "LinkedIn account") : undefined,
      connectUrl: "/api/integrations/linkedin/connect",
      disconnectUrl: linkedinConnected ? "/api/integrations/linkedin/disconnect" : undefined,
      setupReady: linkedinSetup.appConfigured && linkedinSetup.storageReady,
      connectionCheckFailed: linkedinResult.status === "rejected",
    },
    {
      id: "x",
      name: "X",
      short: "X",
      homeUrl: x?.username ? `https://x.com/${x.username}` : "https://x.com/",
      connected: xConnected,
      accountLabel: xConnected ? `@${x?.username || x?.name || "X account"}` : undefined,
      connectUrl: "/api/integrations/x/connect",
      disconnectUrl: xConnected ? "/api/integrations/x/disconnect" : undefined,
      setupReady: xSetup.appConfigured && xSetup.storageReady,
      connectionCheckFailed: xResult.status === "rejected",
    },
    {
      id: "tiktok",
      name: "TikTok",
      short: "TT",
      homeUrl: "https://www.tiktok.com/",
      connected: tiktokConnected,
      accountLabel: tiktokConnected ? (tiktok?.displayName || "TikTok creator") : undefined,
      connectUrl: "/api/integrations/tiktok/connect",
      disconnectUrl: tiktokConnected ? "/api/integrations/tiktok/disconnect" : undefined,
      setupReady: tiktokSetup.appConfigured && tiktokSetup.storageReady,
      connectionCheckFailed: tiktokResult.status === "rejected",
    },
    {
      id: "youtube",
      name: "YouTube",
      short: "YT",
      homeUrl: youtube?.channelId ? `https://www.youtube.com/channel/${youtube.channelId}` : "https://www.youtube.com/",
      connected: youtubeConnected,
      accountLabel: youtubeConnected ? (youtube?.channelTitle || "YouTube channel") : undefined,
      connectUrl: "/api/integrations/youtube/connect",
      disconnectUrl: youtubeConnected ? "/api/integrations/youtube/disconnect" : undefined,
      setupReady: youtubeSetup.appConfigured && youtubeSetup.storageReady,
      connectionCheckFailed: youtubeResult.status === "rejected",
    },
    {
      id: "pinterest",
      name: "Pinterest",
      short: "P",
      homeUrl: pinterest?.username ? `https://www.pinterest.com/${pinterest.username}/` : "https://www.pinterest.com/",
      connected: pinterestConnected,
      accountLabel: pinterestConnected ? `@${pinterest?.username || "Pinterest"}` : undefined,
      connectUrl: "/api/integrations/pinterest/connect",
      disconnectUrl: pinterestConnected ? "/api/integrations/pinterest/disconnect" : undefined,
      setupReady: pinterestSetup.appConfigured && pinterestSetup.storageReady,
      connectionCheckFailed: pinterestResult.status === "rejected",
    },
  ];
}
