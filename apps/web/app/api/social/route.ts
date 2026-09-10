import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { z } from "zod";
import { buildContentPlan } from "../../../../../packages/agents/src/runtime";

const contentRequest = z.object({
  brandName: z.string().min(1).default("Lioness Walk"),
  theme: z.string().min(3).max(300),
  objective: z.string().min(3).max(300),
  brandVoice: z.string().min(3).max(1500),
});

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = contentRequest.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content brief.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const plan = await buildContentPlan(parsed.data);
    return NextResponse.json({ mode: process.env.AI_MODE === "live" ? "live" : "mock", plan });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Content generation failed." }, { status: 500 });
  }
}
