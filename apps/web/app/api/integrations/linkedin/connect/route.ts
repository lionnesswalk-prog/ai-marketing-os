import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { oauthRedirectUri } from "../../../../../lib/app-origin";
import { assertBillingConnectionCapacity } from "../../../../../lib/billing";
import { buildLinkedInOAuthUrl, getLinkedInSetupState } from "../../../../../lib/linkedin-integration";

const STATE_COOKIE = "amos_linkedin_oauth_state";
const WORKSPACE_COOKIE = "amos_linkedin_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  try {
    await assertBillingConnectionCapacity(session.workspaceId, "linkedin");
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_CONNECTION_LIMIT") {
      return NextResponse.redirect(new URL("/social?access=plan-limit", request.url));
    }
    throw error;
  }

  const setup = getLinkedInSetupState();
  if (!setup.appConfigured || !setup.storageReady) {
    return NextResponse.redirect(new URL("/social?linkedin=setup-required", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = oauthRedirectUri(request.nextUrl.origin, "/api/integrations/linkedin/callback");
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
