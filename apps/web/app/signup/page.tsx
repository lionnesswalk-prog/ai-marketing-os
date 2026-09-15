import { redirect } from "next/navigation";
import { getAuthMode } from "../../lib/auth-service";
import { getSession } from "../../lib/auth";
import { SignupForm } from "../../components/SignupForm";

export default async function SignupPage() {
  const existingSession = await getSession();
  if (existingSession) redirect("/dashboard");

  const mode = getAuthMode();

  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">CREATE YOUR WORKSPACE ACCESS</p>
      <h1>Create account</h1>
      <p className="muted large">Create your brand workspace. Your social accounts, campaigns, leads and analytics stay isolated from every other client.</p>
      {mode === "preview" && <div className="preview-note">Preview mode · your test account is stored securely in this browser until the production database is connected.</div>}
      <SignupForm />
      <p className="auth-switch">Already have an account? <a href="/login">Sign in</a></p>
      <p className="muted" style={{ textAlign: "center" }}>Free beta · no payment method required.</p>
    </div>
  );
}
