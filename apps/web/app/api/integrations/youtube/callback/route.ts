import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { exchangeYouTubeCode, saveYouTubeConnection } from "../../../../../lib/youtube-integration";

const STATE_COOKIE = "amos_youtube_oauth_state";
const WORKSPACE_COOKIE = "amos_youtube_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const expectedWorkspace = store.get(WORKSPACE_COOKIE)?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  store.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });

  if (oauthError) return NextResponse.redirect(new URL("/social?youtube=cancelled", request.url));
  if (!code || !expectedState || !expectedWorkspace || session.workspaceId !== expectedWorkspace || !returnedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/social?youtube=invalid-state", request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/youtube/callback`;
    const result = await exchangeYouTubeCode(code, redirectUri);
    await saveYouTubeConnection(result);
    return NextResponse.redirect(new URL("/social?youtube=connected", request.url));
  } catch (error) {
    console.error("YouTube OAuth callback failed", error);
    return NextResponse.redirect(new URL("/social?youtube=failed", request.url));
  }
}
