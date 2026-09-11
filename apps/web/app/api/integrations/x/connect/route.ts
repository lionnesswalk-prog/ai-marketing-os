import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { buildXOAuthUrl, createPkceChallenge, getXSetupState } from "../../../../../lib/x-integration";

const STATE_COOKIE = "amos_x_oauth_state";
const VERIFIER_COOKIE = "amos_x_oauth_verifier";
const WORKSPACE_COOKIE = "amos_x_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const setup = getXSetupState();
  if (!setup.appConfigured || !setup.storageReady) {
    return NextResponse.redirect(new URL("/social?x=setup-required", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createPkceChallenge(verifier);
  const redirectUri = `${request.nextUrl.origin}/api/integrations/x/callback`;
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
