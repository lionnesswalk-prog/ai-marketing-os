import { AuthForm } from "../../components/AuthForm";
import { getAuthMode } from "../../lib/auth-service";

export default function LoginPage() {
  const mode = getAuthMode();
  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">SECURE ACCESS</p>
      <h1>Welcome back</h1>
      <p className="muted large">Sign in to your marketing command center.</p>
      {mode === "preview" && <div className="preview-note">Preview mode · use the same browser and credentials you used on signup.</div>}
      <AuthForm mode="login" />
      <p className="auth-switch">New here? <a href="/signup">Create an account</a></p>
    </div>
  );
}
