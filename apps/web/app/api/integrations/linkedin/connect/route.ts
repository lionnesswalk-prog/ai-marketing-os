import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { buildLinkedInOAuthUrl, getLinkedInSetupState } from "../../../../../lib/linkedin-integration";

const STATE_COOKIE = "amos_linkedin_oauth_state";
const WORKSPACE_COOKIE = "amos_linkedin_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));

  const setup = getLinkedInSetupState();
  if (!setup.appConfigured || !setup.storageReady) {
    return NextResponse.redirect(new URL("/social?linkedin=setup-required", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${request.nextUrl.origin}/api/integrations/linkedin/callback`;
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  store.set(WORKSPACE_COOKIE, session.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildLinkedInOAuthUrl(redirectUri, state));
}
