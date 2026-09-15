import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../lib/brand-profile";
import { z } from "zod";
import { buildStrategy } from "../../../../../packages/agents/src/runtime";
import { assertBillingFeature } from "../../../lib/billing";
import { buildWorkspaceKnowledgeContext } from "../../../lib/knowledge";
import { consumeAiRequest } from "../../../lib/ai-rate-limit";

const strategyRequest = z.object({
  budget: z.coerce.number().positive().max(100000000),
  objective: z.string().min(3).max(300),
  product: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot generate or modify marketing strategy." }, { status: 403 });
  }

  const parsed = strategyRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign brief.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "aiStrategy");
    await consumeAiRequest(session.workspaceId, "strategy");
    const profile = await getCurrentBrandProfile(session);
    const knowledgeContext = await buildWorkspaceKnowledgeContext(session);
    const result = await buildStrategy({
      ...parsed.data,
      brandName: profile.name,
      brandContext: [buildBrandAIContext(profile), knowledgeContext].join("\n\n"),
    });
    return NextResponse.json({ mode: result.mode, plan: result.output, warning: result.warning });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "Free beta AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "AI Strategy is not included in the current plan." }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ error: "Strategy generation failed." }, { status: 500 });
  }
}
