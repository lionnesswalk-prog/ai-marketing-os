import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { finalizePendingMetaPage } from "../../../../../lib/meta-integration";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) {
    return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  }

  const form = await request.formData();
  const pageId = String(form.get("pageId") || "").trim();
  if (!pageId) {
    return NextResponse.redirect(new URL("/social?meta=page-required", request.url));
  }

  try {
    await finalizePendingMetaPage(pageId);
    return NextResponse.redirect(new URL("/social?meta=connected", request.url));
  } catch (error) {
    console.error("Meta Page selection failed", error);
    return NextResponse.redirect(new URL("/social?meta=failed", request.url));
  }
}
