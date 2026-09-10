import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { z } from "zod";
import { buildStrategy } from "../../../../../packages/agents/src/runtime";

const strategyRequest = z.object({
  brandName: z.string().min(1).default("Lioness Walk"),
  budget: z.coerce.number().positive().max(100000000),
  objective: z.string().min(3).max(300),
  product: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = strategyRequest.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign brief.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const plan = await buildStrategy(parsed.data);
    return NextResponse.json({ mode: process.env.AI_MODE === "live" ? "live" : "mock", plan });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Strategy generation failed." }, { status: 500 });
  }
}
