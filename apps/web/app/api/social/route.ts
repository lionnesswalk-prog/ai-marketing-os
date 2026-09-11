import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../lib/brand-profile";
import { z } from "zod";
import { buildContentPlan } from "../../../../../packages/agents/src/runtime";
import { assertBillingFeature } from "../../../lib/billing";

const contentRequest = z.object({
  theme: z.string().min(3).max(300),
  objective: z.string().min(3).max(300),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot generate social content." }, { status: 403 });
  }

  const parsed = contentRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content brief.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "socialPublishing");
    const profile = await getCurrentBrandProfile(session);
    const plan = await buildContentPlan({
      brandName: profile.name,
      theme: parsed.data.theme,
      objective: parsed.data.objective,
      brandVoice: profile.voice || "Clear, specific, credible and consistent with the brand.",
      brandContext: buildBrandAIContext(profile),
    });
    return NextResponse.json({ mode: process.env.AI_MODE === "live" ? "live" : "mock", plan });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Social publishing is not included in the current plan." }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ error: "Content generation failed." }, { status: 500 });
  }
}
