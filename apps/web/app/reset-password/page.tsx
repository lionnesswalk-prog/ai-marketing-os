import { redirect } from "next/navigation";
import { resetPasswordWithToken } from "../../lib/account-security";
import { PasswordField } from "../../components/PasswordField";

async function resetAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) redirect("/reset-password?status=invalid");
  if (password.length < 8 || password !== confirm) redirect("/reset-password?token=" + encodeURIComponent(token) + "&status=password");

  try {
    await resetPasswordWithToken(token, password);
    redirect("/login?reset=success");
  } catch {
    redirect("/reset-password?status=invalid");
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; status?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">SECURE RESET</p>
      <h1>Choose a new password</h1>
      {!params?.token || params?.status === "invalid" ? (
        <>
          <div className="error-box">This reset link is invalid or expired.</div>
          <p className="auth-switch"><a href="/forgot-password">Request a new link</a></p>
        </>
      ) : (
        <form className="auth-form" action={resetAction}>
          <input type="hidden" name="token" value={params.token} />
          <PasswordField label="New password" name="password" autoComplete="new-password" minLength={8} required />
          <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" minLength={8} required />
          {params?.status === "password" && <div className="error-box">Passwords must match and be at least 8 characters.</div>}
          <button className="btn auth-submit" type="submit">Update password</button>
        </form>
      )}
    </div>
  );
}
