import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../../lib/brand-profile";
import { buildWorkspaceKnowledgeContext } from "../../../../lib/knowledge";
import { createBrandStudioDraft } from "../../../../lib/brand-studio";
import { assertBillingFeature } from "../../../../lib/billing";
import { consumeAiRequest } from "../../../../lib/ai-rate-limit";
import { buildBrandPost } from "../../../../../../packages/agents/src/runtime";

const schema = z.object({
  theme: z.string().trim().min(3).max(240),
  objective: z.string().trim().min(3).max(300),
  product: z.string().trim().max(240).optional(),
  preferredPlatform: z.enum(["instagram", "facebook"]).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot generate branded social posts." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Add a clear content theme and objective." }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "socialPublishing");
    await consumeAiRequest(session.workspaceId, "brand-studio");

    const profile = await getCurrentBrandProfile(session);
    const knowledgeContext = await buildWorkspaceKnowledgeContext(session);
    const result = await buildBrandPost({
      brandName: profile.name,
      theme: parsed.data.theme,
      objective: parsed.data.objective,
      product: parsed.data.product,
      preferredPlatform: parsed.data.preferredPlatform,
      brandContext: [buildBrandAIContext(profile), knowledgeContext].join("\n\n"),
    });

    const draft = await createBrandStudioDraft({
      session,
      profile,
      post: result.output,
      fallbackOrigin: new URL(request.url).origin,
      aiMode: result.mode,
      warning: result.warning,
    });

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      warning: result.warning,
      draft,
      creative: result.output,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Brand Studio is not included in the current plan." }, { status: 403 });
    }
    console.error("Brand Studio generation failed", error);
    return NextResponse.json({ error: "Unable to generate this branded post right now." }, { status: 500 });
  }
}
