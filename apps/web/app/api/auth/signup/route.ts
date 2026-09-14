import { NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount, getAuthMode } from "../../../../lib/auth-service";
import { setSession } from "../../../../lib/auth";
import { sendVerificationEmail } from "../../../../lib/account-security";
import {
  assertAuthAllowed,
  clearAuthAttempts,
  recordAuthAttempt,
  signupThrottleKeys,
} from "../../../../lib/auth-rate-limit";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  brandName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  acceptTerms: z.literal(true),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter valid account details and accept the Terms and Privacy Policy." }, { status: 400 });
  }

  const throttleKeys = signupThrottleKeys(request, parsed.data.email);
  try {
    await assertAuthAllowed(throttleKeys);
    await recordAuthAttempt(throttleKeys);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_RATE_LIMITED") {
      return NextResponse.json({ error: "Too many signup attempts. Try again in 15 minutes." }, { status: 429 });
    }
    console.error("signup throttle failed", error);
    return NextResponse.json({ error: "Signup temporarily unavailable. Please try again." }, { status: 503 });
  }

  try {
    const session = await registerAccount({
      name: parsed.data.name,
      brandName: parsed.data.brandName,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    await clearAuthAttempts(throttleKeys);
    await setSession(session);
    await sendVerificationEmail(session, new URL(request.url).origin).catch(() => undefined);
    return NextResponse.json({ ok: true, mode: getAuthMode(), user: session });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SIGNUP_CLOSED") {
      return NextResponse.json({ error: "Public signup is closed. Ask an administrator for an invite." }, { status: 403 });
    }
    console.error("signup failed", error);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
