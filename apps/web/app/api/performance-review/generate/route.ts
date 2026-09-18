import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { getPrisma } from "../../../../lib/prisma";
import { generateWeeklyPerformanceReviewForBrand } from "../../../../lib/performance-review";
import { assertBillingFeature } from "../../../../lib/billing";
import { consumeAiRequest } from "../../../../lib/ai-rate-limit";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot refresh performance reviews." }, { status: 403 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "aiStrategy");
    await consumeAiRequest(session.workspaceId, "performance-review");

    const brand = await getPrisma().brand.findFirst({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });

    const review = await generateWeeklyPerformanceReviewForBrand(brand.id, {
      refreshLearning: true,
    });
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Performance Review is not included in the current plan." }, { status: 403 });
    }
    console.error("manual performance review refresh failed", error);
    return NextResponse.json({ error: "Unable to refresh the performance review right now." }, { status: 500 });
  }
}
