import { NextResponse } from "next/server";
import { canManageLeads, getSession } from "../../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../../lib/brand-profile";
import { z } from "zod";
import { draftInquiryReply } from "../../../../../../packages/agents/src/runtime";
import { assertBillingFeature } from "../../../../lib/billing";

const inquiryRequest = z.object({
  message: z.string().min(1).max(4000),
  verifiedFacts: z.array(z.string().max(500)).max(30).default([]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLeads(session.role)) {
    return NextResponse.json({ error: "Your role cannot draft customer inquiry replies." }, { status: 403 });
  }

  const parsed = inquiryRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inquiry payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "leadWorkspace");
    const profile = await getCurrentBrandProfile(session);
    const draft = await draftInquiryReply({
      ...parsed.data,
      brandName: profile.name,
      brandContext: buildBrandAIContext(profile),
    });
    return NextResponse.json({ mode: process.env.AI_MODE === "live" ? "live" : "mock", draft });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Lead workspace is not included in the current plan." }, { status: 403 });
    }
    console.error(error);
    return NextResponse.json({ error: "Inquiry drafting failed." }, { status: 500 });
  }
}
