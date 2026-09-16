import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { materializeContentCalendarPlan } from "../../../../lib/content-calendar";
import { assertBillingFeature } from "../../../../lib/billing";

const schema = z.object({
  planId: z.string().min(1),
  schedule: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot create or schedule calendar posts." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content calendar request." }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "socialPublishing");
    const result = await materializeContentCalendarPlan({
      session,
      planId: parsed.data.planId,
      fallbackOrigin: new URL(request.url).origin,
      schedule: parsed.data.schedule,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: parsed.data.schedule
        ? result.scheduleFailed
          ? `${result.scheduled} posts scheduled; ${result.scheduleFailed} stayed as drafts because delivery requirements need attention.`
          : `${result.scheduled} posts scheduled with the calendar plan.`
        : `${result.drafts} calendar posts are ready as Brand Studio drafts.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONTENT_CALENDAR_NOT_FOUND") {
      return NextResponse.json({ error: "Content calendar not found in this workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Social publishing is not included in the current plan." }, { status: 403 });
    }
    console.error("content calendar apply failed", error);
    return NextResponse.json({ error: "Unable to create posts from this calendar." }, { status: 500 });
  }
}
