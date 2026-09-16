import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../lib/auth";
import { saveBrandAsset } from "../../../lib/brand-assets";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot upload Brand Studio assets." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a product image to upload." }, { status: 400 });
  }

  try {
    const asset = await saveBrandAsset(session, file);
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "BRAND_ASSET_TYPE_NOT_ALLOWED") {
      return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
    }
    if (code === "BRAND_ASSET_TOO_LARGE") {
      return NextResponse.json({ error: "Use an image up to 6 MB and below 60 megapixels." }, { status: 400 });
    }
    if (code === "BRAND_ASSET_INVALID_IMAGE") {
      return NextResponse.json({ error: "This file could not be read as a valid image." }, { status: 400 });
    }
    console.error("Brand asset upload failed", error);
    return NextResponse.json({ error: "Unable to upload this product image." }, { status: 500 });
  }
}
