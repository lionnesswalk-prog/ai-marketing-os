import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../lib/auth";
import { buildBrandAIContext, getCurrentBrandProfile } from "../../../lib/brand-profile";
import { buildWorkspaceKnowledgeContext } from "../../../lib/knowledge";
import { assertBillingFeature } from "../../../lib/billing";
import { consumeAiRequest } from "../../../lib/ai-rate-limit";
import { answerBrandCopilot } from "../../../../../packages/agents/src/runtime";
import { listBrandCopilotHistory, saveBrandCopilotExchange } from "../../../lib/brand-copilot-history";

const schema = z.object({
  question: z.string().trim().min(2).max(2000),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(3000),
  })).max(12).default([]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ask a clear brand or marketing question." }, { status: 400 });
  }

  try {
    await assertBillingFeature(session.workspaceId, "aiStrategy");
    await consumeAiRequest(session.workspaceId, "brand-copilot");

    const profile = await getCurrentBrandProfile(session);
    const knowledge = await buildWorkspaceKnowledgeContext(session);
    const storedHistory = await listBrandCopilotHistory(session, 12).catch(() => []);
    const result = await answerBrandCopilot({
      question: parsed.data.question,
      recentMessages: storedHistory.length
        ? storedHistory.slice(-10).map((item) => ({ role: item.role, content: item.content }))
        : parsed.data.messages,
      brandContext: [buildBrandAIContext(profile), knowledge].join("\n\n"),
    });

    await saveBrandCopilotExchange({
      session,
      question: parsed.data.question,
      answer: result.output,
      mode: result.mode,
    }).catch((historyError) => console.error("Brand Copilot history save failed", historyError));

    return NextResponse.json({
      ok: true,
      answer: result.output,
      mode: result.mode,
      warning: result.warning,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_RATE_LIMITED") {
      return NextResponse.json({ error: "AI usage limit reached for this hour. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "BILLING_FEATURE_NOT_ENTITLED") {
      return NextResponse.json({ error: "Brand Copilot is not included in the current plan." }, { status: 403 });
    }
    console.error("Brand Copilot failed", error);
    return NextResponse.json({ error: "Brand Copilot is temporarily unavailable." }, { status: 500 });
  }
}
