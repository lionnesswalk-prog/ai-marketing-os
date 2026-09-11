import type { SocialPlatform } from "./domain";
import { getMetaConnection, getMetaSetupState } from "./meta-integration";
import { getLinkedInConnection, getLinkedInSetupState } from "./linkedin-integration";
import { getXConnection, getXSetupState } from "./x-integration";

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
};

export async function getSocialPlatforms(): Promise<SocialPlatformConfig[]> {
  const [meta, linkedin, x] = await Promise.all([
    getMetaConnection().catch(() => null),
    getLinkedInConnection().catch(() => null),
    getXConnection().catch(() => null),
  ]);
  const metaSetup = getMetaSetupState();
  const linkedinSetup = getLinkedInSetupState();
  const xSetup = getXSetupState();
  const instagramConnected = Boolean(meta?.instagramBusinessAccountId && meta.pageAccessToken);
  const facebookConnected = Boolean(meta?.pageId && meta.pageAccessToken);
  const linkedinConnected = Boolean(linkedin?.accessToken && linkedin.authorUrn);
  const xConnected = Boolean(x?.accessToken);

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
    },
    { id: "tiktok", name: "TikTok", short: "TT", homeUrl: "https://www.tiktok.com/", connected: Boolean(process.env.TIKTOK_ACCESS_TOKEN) },
    { id: "youtube", name: "YouTube", short: "YT", homeUrl: "https://www.youtube.com/", connected: Boolean(process.env.YOUTUBE_ACCESS_TOKEN) },
    { id: "pinterest", name: "Pinterest", short: "P", homeUrl: "https://www.pinterest.com/", connected: Boolean(process.env.PINTEREST_ACCESS_TOKEN) },
  ];
}
