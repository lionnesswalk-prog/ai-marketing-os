import type { SocialPlatform } from "./domain";

export type SocialPlatformConfig = {
  id: SocialPlatform;
  name: string;
  short: string;
  homeUrl: string;
  connected: boolean;
};

export function getSocialPlatforms(): SocialPlatformConfig[] {
  return [
    { id: "instagram", name: "Instagram", short: "IG", homeUrl: "https://www.instagram.com/", connected: Boolean(process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) },
    { id: "facebook", name: "Facebook", short: "FB", homeUrl: "https://www.facebook.com/", connected: Boolean(process.env.META_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID) },
    { id: "linkedin", name: "LinkedIn", short: "in", homeUrl: "https://www.linkedin.com/", connected: Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_ID) },
    { id: "x", name: "X", short: "X", homeUrl: "https://x.com/", connected: Boolean(process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET) },
    { id: "tiktok", name: "TikTok", short: "TT", homeUrl: "https://www.tiktok.com/", connected: Boolean(process.env.TIKTOK_ACCESS_TOKEN) },
    { id: "youtube", name: "YouTube", short: "YT", homeUrl: "https://www.youtube.com/", connected: Boolean(process.env.YOUTUBE_ACCESS_TOKEN) },
    { id: "pinterest", name: "Pinterest", short: "P", homeUrl: "https://www.pinterest.com/", connected: Boolean(process.env.PINTEREST_ACCESS_TOKEN) },
  ];
}
