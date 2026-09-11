import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { exchangeMetaCode, saveMetaConnection } from "../../../../../lib/meta-integration";

const STATE_COOKIE = "amos_meta_oauth_state";
const WORKSPACE_COOKIE = "amos_meta_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const expectedWorkspace = store.get(WORKSPACE_COOKIE)?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  store.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(WORKSPACE_COOKIE, "", { path: "/", maxAge: 0 });

  if (oauthError) return NextResponse.redirect(new URL("/social?meta=cancelled", request.url));
  if (!code || !expectedState || !expectedWorkspace || session.workspaceId !== expectedWorkspace || !returnedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL("/social?meta=invalid-state", request.url));
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/meta/callback`;
    const result = await exchangeMetaCode(code, redirectUri);
    const preferredPage = result.pages.find((page) => page.instagram_business_account) || result.pages[0];
    await saveMetaConnection({ userAccessToken: result.userAccessToken, page: preferredPage });
    return NextResponse.redirect(new URL("/social?meta=connected", request.url));
  } catch (error) {
    console.error("Meta OAuth callback failed", error);
    return NextResponse.redirect(new URL("/social?meta=failed", request.url));
  }
}
