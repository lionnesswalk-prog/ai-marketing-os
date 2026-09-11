import { redirect } from "next/navigation";
import { getAuthMode, registerAccount } from "../../lib/auth-service";
import { setSession } from "../../lib/auth";

function errorMessage(code?: string) {
  if (code === "invalid") return "Please enter a valid name, email and password of at least 8 characters.";
  if (code === "exists") return "An account with this email already exists.";
  if (code === "failed") return "Signup failed. Please try again.";
  return "";
}

async function signupAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const brandName = String(formData.get("brandName") ?? "").trim();

  if (name.length < 2 || brandName.length < 2 || !email.includes("@") || password.length < 8) {
    redirect("/signup?error=invalid");
  }

  let destination = "/dashboard";
  try {
    const session = await registerAccount({ name, email, password, brandName });
    await setSession(session);
  } catch (error) {
    destination = error instanceof Error && error.message === "ACCOUNT_EXISTS"
      ? "/signup?error=exists"
      : "/signup?error=failed";
  }

  redirect(destination);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const mode = getAuthMode();
  const params = searchParams ? await searchParams : undefined;
  const message = errorMessage(params?.error);

  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">CREATE YOUR WORKSPACE ACCESS</p>
      <h1>Create account</h1>
      <p className="muted large">Create your brand workspace. Your social accounts, campaigns, leads and analytics stay isolated from every other client.</p>
      {mode === "preview" && <div className="preview-note">Preview mode · your test account is stored securely in this browser until the production database is connected.</div>}
      <form className="auth-form" action={signupAction}>
        <label>Full name<input name="name" autoComplete="name" minLength={2} required placeholder="Your name" /></label>
        <label>Brand / company name<input name="brandName" minLength={2} required placeholder="Your brand name" /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Minimum 8 characters" /></label>
        {message && <div className="error-box" role="alert">{message}</div>}
        <button className="btn auth-submit" type="submit">Create account</button>
      </form>
      <p className="auth-switch">Already have an account? <a href="/login">Sign in</a></p>
    </div>
  );
}
