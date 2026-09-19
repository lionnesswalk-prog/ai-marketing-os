import type { AppSession } from "./auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "./brand-profile";
import { buildWorkspaceKnowledgeContext } from "./knowledge";
import { recommendPostingTimes, type PostingRecommendation } from "./posting-intelligence";
import {
  buildContentLearningContext,
  getContentLearningSummary,
  refreshContentLearning,
} from "./content-learning";
import {
  getContentCalendarPlanBySourceReview,
  saveContentCalendarPlan,
} from "./content-calendar";
import { buildContentCalendar } from "../../../packages/agents/src/runtime";

export type GenerateCalendarInput = {
  session: AppSession;
  horizonDays: 7 | 30;
  objective: string;
  focus?: string;
  timezoneOffsetMinutes: number;
  sourceReviewId?: string;
};

function fallbackTiming(timezoneOffsetMinutes: number) {
  return {
    updatedAt: new Date().toISOString(),
    timezoneOffsetMinutes,
    recommendations: [
      {
        platform: "instagram" as const,
        postingWindow: "evening" as const,
        evidence: "test" as const,
        sampleSize: 0,
        reason: "Live timestamped performance history is unavailable, so this is a controlled testing window rather than a proven best time.",
      },
      {
        platform: "facebook" as const,
        postingWindow: "midday" as const,
        evidence: "test" as const,
        sampleSize: 0,
        reason: "Live timestamped performance history is unavailable, so this is a controlled testing window rather than a proven best time.",
      },
      {
        platform: "pinterest" as const,
        postingWindow: "morning" as const,
        evidence: "test" as const,
        sampleSize: 0,
        reason: "Live timestamped performance history is unavailable, so this is a controlled testing window rather than a proven best time.",
      },
    ],
  };
}

function alignDayOffset(
  original: number,
  targetDayOfWeek: number | undefined,
  horizonDays: number,
  timezoneOffsetMinutes: number,
) {
  if (targetDayOfWeek === undefined) return original;
  const localNow = new Date(Date.now() - timezoneOffsetMinutes * 60_000);
  const localStartDay = localNow.getUTCDay();
  const currentDay = (localStartDay + original) % 7;
  const forward = (targetDayOfWeek - currentDay + 7) % 7;
  const next = original + forward;
  if (next < horizonDays) return next;
  const previous = next - 7;
  return previous >= 0 ? previous : original;
}

export async function generateContentCalendarForSession(input: GenerateCalendarInput) {
  if (input.sourceReviewId) {
    const existing = await getContentCalendarPlanBySourceReview(input.session, input.sourceReviewId);
    if (existing) {
      return {
        reused: true,
        mode: existing.aiMode || "existing",
        warning: undefined,
        summary: "This weekly review already has a next-week content calendar.",
        learning: await getContentLearningSummary(input.session).catch(() => null),
        matchedThisRefresh: 0,
        plan: existing,
      };
    }
  }

  const [profile, knowledge, learningRefresh] = await Promise.all([
    getCurrentBrandProfile(input.session),
    buildWorkspaceKnowledgeContext(input.session),
    refreshContentLearning(input.session)
      .catch(async (error) => {
        console.error("content learning refresh unavailable; using stored learning and test timing", error);
        return {
          analytics: null,
          summary: await getContentLearningSummary(input.session).catch(() => ({
            matchedPostCount: 0,
            evidence: "insufficient" as const,
            platformSummaries: [],
            note: "Content learning is not available yet.",
          })),
          matchedThisRefresh: 0,
        };
      }),
  ]);

  const timing = learningRefresh.analytics
    ? {
        updatedAt: learningRefresh.analytics.updatedAt,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
        recommendations: recommendPostingTimes(
          learningRefresh.analytics.recentContent,
          input.timezoneOffsetMinutes,
        ),
      }
    : fallbackTiming(input.timezoneOffsetMinutes);
  const learningContext = buildContentLearningContext(learningRefresh.summary);

  const postCount = input.horizonDays === 7 ? 4 : 12;
  const timingContext = timing.recommendations.map((item) =>
    [
      item.platform,
      item.evidence === "performance" ? "recent performance evidence" : "test window",
      item.postingWindow,
      item.dayLabel ? `strongest observed day: ${item.dayLabel}` : "",
      `sample: ${item.sampleSize}`,
      item.reason,
    ].filter(Boolean).join(" · ")
  ).join("\n");

  const result = await buildContentCalendar({
    brandName: profile.name,
    objective: input.objective,
    focus: input.focus,
    horizonDays: input.horizonDays,
    postCount,
    brandContext: [buildBrandAIContext(profile), knowledge].join("\n\n"),
    timingContext,
    learningContext,
  });

  const recommendationByPlatform = new Map<string, PostingRecommendation>(
    timing.recommendations.map((item): [string, PostingRecommendation] => [item.platform, item]),
  );

  const entries = result.output.entries.map((entry) => {
    const recommendation = recommendationByPlatform.get(entry.platform) ||
      timing.recommendations[0];
    const clampedOffset = Math.max(0, Math.min(input.horizonDays - 1, entry.dayOffset));
    return {
      ...entry,
      dayOffset: recommendation.evidence === "performance"
        ? alignDayOffset(
            clampedOffset,
            recommendation.dayOfWeek,
            input.horizonDays,
            input.timezoneOffsetMinutes,
          )
        : clampedOffset,
      postingWindow: recommendation.postingWindow,
      timingReason: recommendation.reason,
      timingEvidence: recommendation.evidence,
    };
  });

  const plan = await saveContentCalendarPlan({
    session: input.session,
    horizonDays: input.horizonDays,
    objective: input.objective,
    focus: input.focus,
    aiMode: result.mode,
    sourceReviewId: input.sourceReviewId,
    timing,
    entries,
  });

  return {
    reused: false,
    mode: result.mode,
    warning: result.warning,
    summary: result.output.summary,
    learning: learningRefresh.summary,
    matchedThisRefresh: learningRefresh.matchedThisRefresh,
    plan,
  };
}
