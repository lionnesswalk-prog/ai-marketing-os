import { AuthForm } from "../../components/AuthForm";
import { getAuthMode } from "../../lib/auth-service";

export default function SignupPage() {
  const mode = getAuthMode();
  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">CREATE YOUR WORKSPACE ACCESS</p>
      <h1>Create account</h1>
      <p className="muted large">Sign up to access campaign intelligence, content planning, leads and approval-controlled automation.</p>
      {mode === "preview" && <div className="preview-note">Preview mode · your test account is stored securely in this browser until the production database is connected.</div>}
      <AuthForm mode="signup" />
      <p className="auth-switch">Already have an account? <a href="/login">Sign in</a></p>
    </div>
  );
}
