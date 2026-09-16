import type { ContentAnalytics } from "./social-analytics-types";
import { getSocialAnalytics } from "./social-analytics";

export type PostingWindow = "morning" | "midday" | "evening";
export type TimingEvidence = "performance" | "test";

export type PostingRecommendation = {
  platform: "instagram" | "facebook" | "pinterest";
  postingWindow: PostingWindow;
  dayOfWeek?: number;
  dayLabel?: string;
  evidence: TimingEvidence;
  sampleSize: number;
  averageScore?: number;
  reason: string;
};

const supported = ["instagram", "facebook", "pinterest"] as const;

function engagementScore(item: ContentAnalytics) {
  return (item.views || 0) +
    (item.impressions || 0) +
    (item.engagements || 0) * 4 +
    (item.likes || 0) * 3 +
    (item.comments || 0) * 5 +
    (item.shares || 0) * 6 +
    (item.saves || 0) * 5;
}

function windowForHour(hour: number): PostingWindow {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "midday";
  return "evening";
}

function localParts(publishedAt: string, timezoneOffsetMinutes: number) {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return null;
  const local = new Date(timestamp - timezoneOffsetMinutes * 60_000);
  return {
    hour: local.getUTCHours(),
    dayOfWeek: local.getUTCDay(),
  };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function fallback(platform: PostingRecommendation["platform"]): PostingRecommendation {
  const postingWindow: PostingWindow =
    platform === "facebook" ? "midday" :
    platform === "pinterest" ? "morning" :
    "evening";

  return {
    platform,
    postingWindow,
    evidence: "test",
    sampleSize: 0,
    reason: "Not enough timestamped performance history is available yet. This is a controlled testing window, not a proven best time.",
  };
}

export function recommendPostingTimes(
  recentContent: ContentAnalytics[],
  timezoneOffsetMinutes = 0,
) {
  const recommendations: PostingRecommendation[] = [];

  for (const platform of supported) {
    const samples = recentContent.flatMap((item) => {
      if (item.platform !== platform || !item.publishedAt) return [];
      const local = localParts(item.publishedAt, timezoneOffsetMinutes);
      if (!local) return [];
      const score = engagementScore(item);
      if (!Number.isFinite(score)) return [];
      return [{ ...local, score }];
    });

    const useful = samples.filter((sample) => sample.score > 0);
    if (useful.length < 3) {
      const base = fallback(platform);
      recommendations.push({
        ...base,
        sampleSize: useful.length,
        reason: useful.length
          ? `Only ${useful.length} recent timestamped post${useful.length === 1 ? "" : "s"} with measurable engagement are available. Keep this as a test window until more history accumulates.`
          : base.reason,
      });
      continue;
    }

    const windowScores = new Map<PostingWindow, number[]>();
    const dayScores = new Map<number, number[]>();
    for (const sample of useful) {
      const window = windowForHour(sample.hour);
      windowScores.set(window, [...(windowScores.get(window) || []), sample.score]);
      dayScores.set(sample.dayOfWeek, [...(dayScores.get(sample.dayOfWeek) || []), sample.score]);
    }

    const rankedWindows = [...windowScores.entries()]
      .map(([window, scores]) => ({ window, score: average(scores), count: scores.length }))
      .sort((a, b) => b.score - a.score);
    const bestWindow = rankedWindows[0];

    const rankedDays = [...dayScores.entries()]
      .map(([day, scores]) => ({ day, score: average(scores), count: scores.length }))
      .sort((a, b) => b.score - a.score);
    const bestDay = useful.length >= 5 ? rankedDays[0] : undefined;
    const dayLabel = bestDay
      ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][bestDay.day]
      : undefined;

    recommendations.push({
      platform,
      postingWindow: bestWindow?.window || fallback(platform).postingWindow,
      dayOfWeek: bestDay?.day,
      dayLabel,
      evidence: "performance",
      sampleSize: useful.length,
      averageScore: bestWindow?.score,
      reason: bestDay
        ? `Based on ${useful.length} recent timestamped posts, ${bestWindow.window} is the strongest observed window and ${dayLabel} is the strongest observed day. This is correlation from recent account data, not a guarantee.`
        : `Based on ${useful.length} recent timestamped posts, ${bestWindow.window} is the strongest observed window. More history is needed before making a day-of-week recommendation.`,
    });
  }

  return recommendations;
}

export async function buildPostingRecommendations(timezoneOffsetMinutes = 0) {
  const analytics = await getSocialAnalytics();
  return {
    updatedAt: analytics.updatedAt,
    timezoneOffsetMinutes,
    recommendations: recommendPostingTimes(analytics.recentContent, timezoneOffsetMinutes),
  };
}
