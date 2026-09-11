import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../lib/auth";
import { createCampaignDraft, listCampaigns } from "../../../lib/repository";

const campaignDraft = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(["meta", "google"]),
  dailyBudget: z.coerce.number().min(100).max(10000000),
});

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listCampaigns());
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot create campaign drafts." }, { status: 403 });
  }

  const parsed = campaignDraft.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a campaign name, channel and valid daily budget." }, { status: 400 });
  }

  try {
    const campaign = await createCampaignDraft(parsed.data);
    return NextResponse.json({
      ok: true,
      campaign,
      message: "Campaign draft saved. No provider campaign was launched.",
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create campaign draft." }, { status: 500 });
  }
}
