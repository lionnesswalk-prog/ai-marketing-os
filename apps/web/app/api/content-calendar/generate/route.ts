import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { assertBillingFeature } from "../../../../lib/billing";
import { consumeAiRequest } from "../../../../lib/ai-rate-limit";
import { generateContentCalendarForSession } from "../../../../lib/content-calendar-generator";

const schema = z.object({
  horizonDays: z.union([z.literal(7), z.literal(30)]),
  objective: z.string().trim().min(3).max(300),
  focus: z.string().trim().max(240).optional(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});

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

    const result = await generateContentCalendarForSession({
      session,
      horizonDays: parsed.data.horizonDays,
      objective: parsed.data.objective,
      focus: parsed.data.focus,
      timezoneOffsetMinutes: parsed.data.timezoneOffsetMinutes,
    });

    return NextResponse.json({ ok: true, ...result });
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
