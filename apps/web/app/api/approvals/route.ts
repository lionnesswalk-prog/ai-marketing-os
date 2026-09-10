import { NextResponse } from "next/server";
import { z } from "zod";
import { canDecideApprovals, getSession } from "../../../lib/auth";
import { decideApproval, listApprovals } from "../../../lib/repository";

const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export async function GET() {
  return NextResponse.json(await listApprovals());
}

export async function POST(request: Request) {
  const session = getSession();
  if (!canDecideApprovals(session.role)) {
    return NextResponse.json({ error: "Your role cannot decide spend-impacting approvals." }, { status: 403 });
  }

  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval decision.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await decideApproval(parsed.data.id, parsed.data.decision, session.email);
  if (!updated) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  return NextResponse.json(updated);
}
