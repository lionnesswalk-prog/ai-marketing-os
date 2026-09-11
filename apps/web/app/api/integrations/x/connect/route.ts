import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";
import { oauthRedirectUri } from "../../../../../lib/app-origin";
import { assertBillingConnectionCapacity } from "../../../../../lib/billing";
import { buildXOAuthUrl, createPkceChallenge, getXSetupState } from "../../../../../lib/x-integration";

const STATE_COOKIE = "amos_x_oauth_state";
const VERIFIER_COOKIE = "amos_x_oauth_verifier";
const WORKSPACE_COOKIE = "amos_x_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));
  try {
    await assertBillingConnectionCapacity(session.workspaceId, "x");
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_CONNECTION_LIMIT") {
      return NextResponse.redirect(new URL("/social?access=plan-limit", request.url));
    }
    throw error;
  }

  const setup = getXSetupState();
  if (!setup.appConfigured || !setup.storageReady) {
    return NextResponse.redirect(new URL("/social?x=setup-required", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createPkceChallenge(verifier);
  const redirectUri = oauthRedirectUri(request.nextUrl.origin, "/api/integrations/x/callback");
  const store = await cookies();

  for (const [name, value] of [[STATE_COOKIE, state], [VERIFIER_COOKIE, verifier], [WORKSPACE_COOKIE, session.workspaceId]] as const) {
    store.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  return NextResponse.redirect(buildXOAuthUrl(redirectUri, state, challenge));
}
