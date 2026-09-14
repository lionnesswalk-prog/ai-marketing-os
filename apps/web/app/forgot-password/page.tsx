import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "../../lib/account-security";

async function requestAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) redirect("/forgot-password?status=invalid");

  const h = await headers();
  const origin = h.get("origin") || undefined;
  try {
    await requestPasswordReset(email, origin);
    redirect("/forgot-password?status=sent");
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_PROVIDER_NOT_CONFIGURED") {
      redirect("/forgot-password?status=unavailable");
    }
    redirect("/forgot-password?status=sent");
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Reset your password</h1>
      <p className="muted large">Enter your account email. If the account exists, we will send a secure reset link.</p>
      <form className="auth-form" action={requestAction}>
        <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></label>
        {params?.status === "sent" && <div className="profile-notice success">If an account exists for that email, a reset link has been sent.</div>}
        {params?.status === "invalid" && <div className="error-box">Enter a valid email address.</div>}
        {params?.status === "unavailable" && <div className="error-box">Email recovery is temporarily unavailable. Contact support.</div>}
        <button className="btn auth-submit" type="submit">Send reset link</button>
      </form>
      <p className="auth-switch"><a href="/login">Back to sign in</a></p>
    </div>
  );
}
