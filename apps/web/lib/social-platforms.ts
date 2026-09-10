import type { SocialPlatform } from "./domain";
import { getMetaConnection, getMetaSetupState } from "./meta-integration";

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
  const meta = await getMetaConnection().catch(() => null);
  const metaSetup = getMetaSetupState();
  const instagramConnected = Boolean(meta?.instagramBusinessAccountId && meta.pageAccessToken);
  const facebookConnected = Boolean(meta?.pageId && meta.pageAccessToken);

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
    { id: "linkedin", name: "LinkedIn", short: "in", homeUrl: "https://www.linkedin.com/", connected: Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_ID) },
    { id: "x", name: "X", short: "X", homeUrl: "https://x.com/", connected: Boolean(process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET) },
    { id: "tiktok", name: "TikTok", short: "TT", homeUrl: "https://www.tiktok.com/", connected: Boolean(process.env.TIKTOK_ACCESS_TOKEN) },
    { id: "youtube", name: "YouTube", short: "YT", homeUrl: "https://www.youtube.com/", connected: Boolean(process.env.YOUTUBE_ACCESS_TOKEN) },
    { id: "pinterest", name: "Pinterest", short: "P", homeUrl: "https://www.pinterest.com/", connected: Boolean(process.env.PINTEREST_ACCESS_TOKEN) },
  ];
}
