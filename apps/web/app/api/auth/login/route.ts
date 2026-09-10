import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAccount, getAuthMode } from "../../../../lib/auth-service";
import { setSession } from "../../../../lib/auth";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });

  try {
    const session = await authenticateAccount(parsed.data);
    await setSession(session);
    return NextResponse.json({ ok: true, mode: getAuthMode(), user: session });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    console.error("login failed", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
