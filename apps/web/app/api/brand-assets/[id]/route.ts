import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { getBrandAsset } from "../../../../lib/brand-assets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const asset = await getBrandAsset(session, id);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    status: 200,
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "private, max-age=3600",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
