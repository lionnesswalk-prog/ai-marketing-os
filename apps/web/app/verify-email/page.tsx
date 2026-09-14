import { redirect } from "next/navigation";
import { verifyEmailToken } from "../../lib/account-security";

async function verifyAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/verify-email?status=invalid");
  try {
    await verifyEmailToken(token);
    redirect("/profile?status=verified");
  } catch {
    redirect("/verify-email?status=invalid");
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; status?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">EMAIL VERIFICATION</p>
      <h1>Verify your email</h1>
      {params?.token ? (
        <form className="auth-form" action={verifyAction}>
          <input type="hidden" name="token" value={params.token} />
          <p className="muted large">Confirm this email verification link to secure your account.</p>
          <button className="btn auth-submit" type="submit">Verify email</button>
        </form>
      ) : (
        <div className="error-box">This verification link is invalid or missing.</div>
      )}
      {params?.status === "invalid" && <div className="error-box">The verification link is invalid or expired. Request a new one from Profile.</div>}
    </div>
  );
}
