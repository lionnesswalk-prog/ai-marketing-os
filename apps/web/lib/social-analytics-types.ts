import type { SocialPlatform } from "./domain";

export type AnalyticsAvailability = "live" | "needs_permission" | "not_connected" | "unavailable";

export type ChannelAnalytics = {
  platform: SocialPlatform;
  name: string;
  availability: AnalyticsAvailability;
  accountLabel?: string;
  followers?: number;
  views?: number;
  impressions?: number;
  reach?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  posts?: number;
  note?: string;
};

export type ContentAnalytics = {
  platform: SocialPlatform;
  id: string;
  title: string;
  url?: string;
  views?: number;
  impressions?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
};

export type SocialAnalyticsView = {
  updatedAt: string;
  liveChannels: number;
  channels: ChannelAnalytics[];
  totals: {
    views: number;
    impressions: number;
    engagements: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  topContent: ContentAnalytics[];
};
