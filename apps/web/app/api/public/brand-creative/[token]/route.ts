import { NextResponse } from "next/server";
import { publicCreativeByToken } from "../../../../../lib/brand-studio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const image = await publicCreativeByToken(token);
  if (!image) {
    return NextResponse.json({ error: "Creative not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
