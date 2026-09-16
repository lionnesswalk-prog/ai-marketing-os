import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageMarketing, getSession } from "../../../../lib/auth";
import { updateBrandStudioDraft } from "../../../../lib/brand-studio";

const schema = z.object({
  postId: z.string().min(1),
  headline: z.string().trim().min(1).max(80),
  subheadline: z.string().trim().max(160).default(""),
  caption: z.string().max(2200),
  cta: z.string().trim().max(80).default(""),
  hashtags: z.string().max(1000).default(""),
  pinterestBoardId: z.string().trim().max(200).optional(),
  creativeTemplate: z.enum(["editorial", "split", "minimal"]).optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot edit Brand Studio drafts." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the draft copy and try again." }, { status: 400 });
  }

  try {
    const draft = await updateBrandStudioDraft({
      session,
      fallbackOrigin: new URL(request.url).origin,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "BRAND_STUDIO_DRAFT_NOT_FOUND") {
      return NextResponse.json({ error: "This Brand Studio draft is no longer editable." }, { status: 404 });
    }
    if (code === "BRAND_STUDIO_DRAFT_INVALID") {
      return NextResponse.json({ error: "This post was not created by Brand Studio." }, { status: 409 });
    }
    console.error("Brand Studio draft update failed", error);
    return NextResponse.json({ error: "Unable to save the Brand Studio changes." }, { status: 500 });
  }
}
