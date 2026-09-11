import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../lib/auth";
import { updateBrandProfile } from "../../../lib/brand-profile";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  website: z.union([z.string().trim().url(), z.literal("")]).default(""),
  industry: z.string().trim().max(160).default(""),
  audience: z.string().trim().max(1200).default(""),
  positioning: z.string().trim().max(1200).default(""),
  voice: z.string().trim().max(1200).default(""),
  proofPoints: z.string().trim().max(3000).default(""),
  avoid: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(3000).default(""),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot edit the brand profile." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the brand profile fields and website URL." }, { status: 400 });
  }

  try {
    const profile = await updateBrandProfile(session, parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "DATABASE_MODE_REQUIRED") {
      return NextResponse.json({ error: "Brand profile persistence requires production database mode." }, { status: 409 });
    }
    if (code === "BRAND_NOT_FOUND") {
      return NextResponse.json({ error: "No brand is attached to this workspace." }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to update the brand profile." }, { status: 500 });
  }
}
