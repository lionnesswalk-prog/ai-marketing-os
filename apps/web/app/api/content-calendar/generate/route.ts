import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../../lib/brand-profile";
import { buildWorkspaceKnowledgeContext } from "../../../../lib/knowledge";
import { buildPostingRecommendations } from "../../../../lib/posting-intelligence";
import { saveContentCalendarPlan } from "../../../../lib/content-calendar";
import { assertBillingFeature } from "../../../../lib/billing";
import { consumeAiRequest } from "../../../../lib/ai-rate-limit";
import { buildContentCalendar } from "../../../../../../packages/agents/src/runtime";

const schema = z.object({
  horizonDays: z.union([z.literal(7), z.literal(30)]),
  objective: z.string().trim().min(3).max(300),
  focus: z.string().trim().max(240).optional(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});

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

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot generate a content calendar." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a 7-day or 30-day plan and add a clear objective." }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "aiStrategy");
    await consumeAiRequest(session.workspaceId, "content-calendar");

    const [profile, knowledge, timing] = await Promise.all([
      getCurrentBrandProfile(session),
      buildWorkspaceKnowledgeContext(session),
      buildPostingRecommendations(parsed.data.timezoneOffsetMinutes)
        .catch((error) => {
          console.error("posting intelligence unavailable; using test windows", error);
          return fallbackTiming(parsed.data.timezoneOffsetMinutes);
        }),
    ]);

    const postCount = parsed.data.horizonDays === 7 ? 4 : 12;
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
      objective: parsed.data.objective,
      focus: parsed.data.focus,
      horizonDays: parsed.data.horizonDays,
      postCount,
      brandContext: [buildBrandAIContext(profile), knowledge].join("\n\n"),
      timingContext,
    });

    const recommendationByPlatform = new Map(
      timing.recommendations.map((item) => [item.platform, item]),
    );

    const entries = result.output.entries.map((entry) => {
      const recommendation = recommendationByPlatform.get(entry.platform) ||
        timing.recommendations[0];
      const clampedOffset = Math.max(0, Math.min(parsed.data.horizonDays - 1, entry.dayOffset));
      return {
        ...entry,
        dayOffset: recommendation.evidence === "performance"
          ? alignDayOffset(
              clampedOffset,
              recommendation.dayOfWeek,
              parsed.data.horizonDays,
              parsed.data.timezoneOffsetMinutes,
            )
          : clampedOffset,
        postingWindow: recommendation.postingWindow,
        timingReason: recommendation.reason,
        timingEvidence: recommendation.evidence,
      };
    });

    const plan = await saveContentCalendarPlan({
      session,
      horizonDays: parsed.data.horizonDays,
      objective: parsed.data.objective,
      focus: parsed.data.focus,
      aiMode: result.mode,
      timing,
      entries,
    });

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      warning: result.warning,
      summary: result.output.summary,
      plan,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "AI Content Calendar is not included in the current plan." }, { status: 403 });
    }
    console.error("content calendar generation failed", error);
    return NextResponse.json({ error: "Unable to generate this content calendar right now." }, { status: 500 });
  }
}
