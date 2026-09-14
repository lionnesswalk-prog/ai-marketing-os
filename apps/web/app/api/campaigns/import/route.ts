import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { importCampaignPerformance } from "../../../../lib/repository";

const rowSchema = z.object({
  channel: z.enum(["meta", "google"]),
  externalId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1).max(60).default("active"),
  dailyBudget: z.number().nonnegative().max(1_000_000_000).optional(),
  spend: z.number().nonnegative().max(1_000_000_000_000),
  impressions: z.number().nonnegative().max(10_000_000_000),
  clicks: z.number().nonnegative().max(10_000_000_000),
  conversions: z.number().nonnegative().max(10_000_000_000),
  revenue: z.number().nonnegative().max(1_000_000_000_000),
  frequency: z.number().nonnegative().max(1000).optional(),
  capturedAt: z.string().datetime().optional(),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot import campaign performance." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      error: "Campaign import contains invalid rows. Check channel, IDs and numeric metrics.",
      issues: parsed.error.flatten(),
    }, { status: 400 });
  }

  try {
    const result = await importCampaignPerformance(parsed.data.rows);
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Imported ${result.metrics} metric row${result.metrics === 1 ? "" : "s"} across ${result.campaigns} campaign${result.campaigns === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("campaign import failed", error);
    return NextResponse.json({ error: "Unable to import campaign performance." }, { status: 500 });
  }
}
