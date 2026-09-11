import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { canManageIntegrations, getSession } from "../../../../../lib/auth";\nimport { assertBillingConnectionCapacity } from "../../../../../lib/billing";
import { buildPinterestOAuthUrl, getPinterestSetupState } from "../../../../../lib/pinterest-integration";

const STATE_COOKIE = "amos_pinterest_oauth_state";
const WORKSPACE_COOKIE = "amos_pinterest_oauth_workspace";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(session.role)) return NextResponse.redirect(new URL("/social?access=forbidden", request.url));\n  try {\n    await assertBillingConnectionCapacity(session.workspaceId, "pinterest");\n  } catch (error) {\n    if (error instanceof Error && error.message === "BILLING_CONNECTION_LIMIT") {\n      return NextResponse.redirect(new URL("/social?access=plan-limit", request.url));\n    }\n    throw error;\n  }

  const setup = getPinterestSetupState();
  if (!setup.appConfigured || !setup.storageReady) {
    return NextResponse.redirect(new URL("/social?pinterest=setup-required", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${request.nextUrl.origin}/api/integrations/pinterest/callback`;
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

  return NextResponse.redirect(buildPinterestOAuthUrl(redirectUri, state));
}
