import type { ChannelAnalytics, ContentAnalytics, SocialAnalyticsView } from "./social-analytics-types";
import { getSocialPlatforms } from "./social-platforms";
import { fetchMetaAnalytics } from "./meta-integration";
import { fetchYouTubeAnalytics } from "./youtube-integration";
import { fetchTikTokAnalytics } from "./tiktok-integration";
import { fetchXAnalytics } from "./x-integration";
import { fetchPinterestAnalytics } from "./pinterest-integration";

function channelBase(platform: ChannelAnalytics["platform"], name: string, connected: boolean): ChannelAnalytics {
  return {
    platform,
    name,
    availability: connected ? "unavailable" : "not_connected",
    note: connected ? "Analytics adapter is not enabled for this connection yet." : "Connect this channel in Social Hub to load live analytics.",
  };
}

function engagementScore(item: ContentAnalytics) {
  return (item.views || 0) + (item.impressions || 0) + (item.engagements || 0) * 4 +
    (item.likes || 0) * 3 + (item.comments || 0) * 5 + (item.shares || 0) * 6 + (item.saves || 0) * 5;
}

export async function getSocialAnalytics(): Promise<SocialAnalyticsView> {
  const platforms = await getSocialPlatforms();
  const connected = new Map(platforms.map((item) => [item.id, item]));

  const channels: ChannelAnalytics[] = [
    channelBase("instagram", "Instagram", Boolean(connected.get("instagram")?.connected)),
    channelBase("facebook", "Facebook", Boolean(connected.get("facebook")?.connected)),
    channelBase("linkedin", "LinkedIn", Boolean(connected.get("linkedin")?.connected)),
    channelBase("x", "X", Boolean(connected.get("x")?.connected)),
    channelBase("tiktok", "TikTok", Boolean(connected.get("tiktok")?.connected)),
    channelBase("youtube", "YouTube", Boolean(connected.get("youtube")?.connected)),
    channelBase("pinterest", "Pinterest", Boolean(connected.get("pinterest")?.connected)),
  ];
  const byPlatform = new Map(channels.map((item) => [item.platform, item]));
  const topContent: ContentAnalytics[] = [];

  if (connected.get("instagram")?.connected || connected.get("facebook")?.connected) {
    try {
      const data = await fetchMetaAnalytics();
      if (data.facebook) {
        Object.assign(byPlatform.get("facebook")!, {
          availability: "live",
          accountLabel: data.facebook.accountLabel,
          followers: data.facebook.followers,
          likes: data.facebook.likes,
          note: "Live Facebook Page follower and fan totals.",
        });
      }
      if (data.instagram) {
        Object.assign(byPlatform.get("instagram")!, {
          availability: "live",
          accountLabel: data.instagram.accountLabel,
          followers: data.instagram.followers,
          posts: data.instagram.posts,
          likes: data.instagram.media.reduce((sum, item) => sum + item.likes, 0),
          comments: data.instagram.media.reduce((sum, item) => sum + item.comments, 0),
          note: "Live Instagram profile totals and recent media engagement.",
        });
        topContent.push(...data.instagram.media.map((item) => ({
          platform: "instagram" as const,
          id: item.id,
          title: item.title,
          url: item.url,
          likes: item.likes,
          comments: item.comments,
        })));
      }
    } catch (error) {
      const note = error instanceof Error ? error.message : "Meta analytics unavailable.";
      for (const platform of ["facebook", "instagram"] as const) {
        const current = byPlatform.get(platform)!;
        if (connected.get(platform)?.connected) Object.assign(current, { availability: "needs_permission", note });
      }
    }
  }

  if (connected.get("youtube")?.connected) {
    try {
      const data = await fetchYouTubeAnalytics();
      Object.assign(byPlatform.get("youtube")!, {
        availability: "live",
        accountLabel: data.accountLabel,
        followers: data.followers,
        views: data.views,
        posts: data.posts,
        likes: data.videos.reduce((sum, item) => sum + item.likes, 0),
        comments: data.videos.reduce((sum, item) => sum + item.comments, 0),
        note: "Live channel totals plus latest video statistics.",
      });
      topContent.push(...data.videos.map((item) => ({ platform: "youtube" as const, ...item })));
    } catch (error) {
      Object.assign(byPlatform.get("youtube")!, {
        availability: "needs_permission",
        note: error instanceof Error ? error.message : "YouTube analytics unavailable.",
      });
    }
  }

  if (connected.get("tiktok")?.connected) {
    try {
      const data = await fetchTikTokAnalytics();
      Object.assign(byPlatform.get("tiktok")!, {
        availability: "live",
        accountLabel: data.accountLabel,
        followers: data.followers,
        likes: data.likes,
        posts: data.posts,
        views: data.videos.reduce((sum, item) => sum + item.views, 0),
        comments: data.videos.reduce((sum, item) => sum + item.comments, 0),
        shares: data.videos.reduce((sum, item) => sum + item.shares, 0),
        note: "Live TikTok profile and recent public video statistics.",
      });
      topContent.push(...data.videos.map((item) => ({ platform: "tiktok" as const, ...item })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "TikTok analytics unavailable.";
      Object.assign(byPlatform.get("tiktok")!, {
        availability: "needs_permission",
        note: message === "TIKTOK_ANALYTICS_PERMISSION_REQUIRED"
          ? "Reconnect TikTok to grant user.info.stats and video.list analytics permissions."
          : message,
      });
    }
  }

  if (connected.get("x")?.connected) {
    try {
      const data = await fetchXAnalytics();
      Object.assign(byPlatform.get("x")!, {
        availability: "live",
        accountLabel: data.accountLabel,
        followers: data.followers,
        posts: data.posts,
        impressions: data.tweets.reduce((sum, item) => sum + item.impressions, 0),
        likes: data.tweets.reduce((sum, item) => sum + item.likes, 0),
        comments: data.tweets.reduce((sum, item) => sum + item.comments, 0),
        shares: data.tweets.reduce((sum, item) => sum + item.shares, 0),
        saves: data.tweets.reduce((sum, item) => sum + item.saves, 0),
        note: "Live public metrics for the latest X posts.",
      });
      topContent.push(...data.tweets.map((item) => ({ platform: "x" as const, ...item })));
    } catch (error) {
      Object.assign(byPlatform.get("x")!, {
        availability: "needs_permission",
        note: error instanceof Error ? error.message : "X analytics unavailable.",
      });
    }
  }

  if (connected.get("pinterest")?.connected) {
    try {
      const data = await fetchPinterestAnalytics();
      Object.assign(byPlatform.get("pinterest")!, {
        availability: "live",
        accountLabel: data.accountLabel,
        posts: data.posts,
        impressions: data.impressions,
        engagements: data.engagements,
        saves: data.saves,
        note: "Organic Pin metrics from the connected Pinterest account.",
      });
      topContent.push(...data.pins.map((item) => ({
        platform: "pinterest" as const,
        id: item.id,
        title: item.title,
        url: item.url,
        impressions: item.impressions,
        engagements: item.engagements,
        saves: item.saves,
      })));
    } catch (error) {
      Object.assign(byPlatform.get("pinterest")!, {
        availability: "needs_permission",
        note: error instanceof Error ? error.message : "Pinterest analytics unavailable.",
      });
    }
  }

  if (connected.get("linkedin")?.connected) {
    Object.assign(byPlatform.get("linkedin")!, {
      availability: "needs_permission",
      accountLabel: connected.get("linkedin")?.accountLabel,
      note: "LinkedIn analytics requires Community Management access and r_member_postAnalytics permission.",
    });
  }

  const totals = channels.reduce((sum, item) => ({
    views: sum.views + (item.views || 0),
    impressions: sum.impressions + (item.impressions || 0),
    engagements: sum.engagements + (item.engagements || 0),
    likes: sum.likes + (item.likes || 0),
    comments: sum.comments + (item.comments || 0),
    shares: sum.shares + (item.shares || 0),
    saves: sum.saves + (item.saves || 0),
  }), { views: 0, impressions: 0, engagements: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

  return {
    updatedAt: new Date().toISOString(),
    liveChannels: channels.filter((item) => item.availability === "live").length,
    channels,
    totals,
    topContent: topContent.sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 12),
  };
}
