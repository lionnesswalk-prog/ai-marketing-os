import { NextResponse } from "next/server";
import { z } from "zod";
import { registerAccount, getAuthMode } from "../../../../lib/auth-service";
import { setSession } from "../../../../lib/auth";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid name, email and password of at least 8 characters." }, { status: 400 });
  }

  try {
    const session = await registerAccount(parsed.data);
    await setSession(session);
    return NextResponse.json({ ok: true, mode: getAuthMode(), user: session });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SIGNUP_CLOSED") {
      return NextResponse.json({ error: "Public signup is closed for this workspace. Ask an administrator to add you." }, { status: 403 });
    }
    console.error("signup failed", error);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
