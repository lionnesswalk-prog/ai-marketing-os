import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import { assertBillingFeature } from "../../../../../lib/billing";
import { consumeAiRequest } from "../../../../../lib/ai-rate-limit";
import { getPrisma } from "../../../../../lib/prisma";
import { getContentCalendarPlanBySourceReview } from "../../../../../lib/content-calendar";
import { generateContentCalendarForSession } from "../../../../../lib/content-calendar-generator";

const schema = z.object({
  reviewId: z.string().min(1),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot build a next-week plan." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid performance review request." }, { status: 400 });
  }

  try {
    const existing = await getContentCalendarPlanBySourceReview(session, parsed.data.reviewId);
    if (existing) {
      return NextResponse.json({
        ok: true,
        reused: true,
        plan: existing,
        message: "This review already has a next-week content calendar.",
      });
    }

    const review = await getPrisma().weeklyPerformanceReview.findFirst({
      where: {
        id: parsed.data.reviewId,
        brand: { is: { workspaceId: session.workspaceId } },
      },
      select: {
        id: true,
        reviewJson: true,
      },
    });
    if (!review) {
      return NextResponse.json({ error: "Performance review not found in this workspace." }, { status: 404 });
    }

    await assertBillingFeature(session.workspaceId, "aiStrategy");
    await consumeAiRequest(session.workspaceId, "review-next-week-plan");

    const reviewData = asObject(review.reviewJson);
    const priorities = stringArray(reviewData.nextWeekPriorities);
    const experiments = Array.isArray(reviewData.experiments)
      ? reviewData.experiments
          .map((item) => {
            const value = asObject(item);
            const hypothesis = typeof value.hypothesis === "string" ? value.hypothesis : "";
            const action = typeof value.action === "string" ? value.action : "";
            return [hypothesis, action].filter(Boolean).join(" — ");
          })
          .filter(Boolean)
      : [];

    const objective = "Turn the latest weekly performance review into a controlled 7-day content plan that balances evidence-backed iteration with deliberate experimentation.";
    const focus = [
      priorities.length ? "Next-week priorities: " + priorities.join(" | ") : "",
      experiments.length ? "Experiments to translate into content: " + experiments.join(" | ") : "",
    ].filter(Boolean).join("\n\n");

    const result = await generateContentCalendarForSession({
      session,
      horizonDays: 7,
      objective,
      focus: focus || "Build a disciplined next-week testing plan from the latest verified performance review.",
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
      sourceReviewId: review.id,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: result.reused
        ? "This review already has a next-week content calendar."
        : "Next-week content calendar created from the latest performance review.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "AI Content Calendar is not included in the current plan." }, { status: 403 });
    }
    console.error("review-to-calendar generation failed", error);
    return NextResponse.json({ error: "Unable to build the next-week plan right now." }, { status: 500 });
  }
}
