import { NextResponse } from "next/server";
import { canManageLeads, getSession } from "../../../../lib/auth";
import { z } from "zod";
import { draftInquiryReply } from "../../../../../../packages/agents/src/runtime";

const inquiryRequest = z.object({
  message: z.string().min(1).max(4000),
  verifiedFacts: z.array(z.string().max(500)).max(30).default([]),
  brandName: z.string().min(1).default("Lioness Walk"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLeads(session.role)) return NextResponse.json({ error: "Your role cannot draft customer inquiry replies." }, { status: 403 });
  const parsed = inquiryRequest.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inquiry payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const draft = await draftInquiryReply(parsed.data);
    return NextResponse.json({ mode: process.env.AI_MODE === "live" ? "live" : "mock", draft });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Inquiry drafting failed." }, { status: 500 });
  }
}
