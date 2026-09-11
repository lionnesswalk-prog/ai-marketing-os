import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { exchangeTikTokCode, saveTikTokConnection } from "../../../../../lib/tiktok-integration";

const STATE_COOKIE = "amos_tiktok_oauth_state";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  store.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });

  if (oauthError) return NextResponse.redirect(new URL("/social?tiktok=cancelled", request.url));
  if (!code || !expectedState || !returnedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/social?tiktok=invalid-state", request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/tiktok/callback`;
    const result = await exchangeTikTokCode(code, redirectUri);
    await saveTikTokConnection(result);
    return NextResponse.redirect(new URL("/social?tiktok=connected", request.url));
  } catch (error) {
    console.error("TikTok OAuth callback failed", error);
    return NextResponse.redirect(new URL("/social?tiktok=failed", request.url));
  }
}
