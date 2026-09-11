import { redirect } from "next/navigation";
import { authenticateAccount, getAuthMode } from "../../lib/auth-service";
import { setSession } from "../../lib/auth";

function errorMessage(code?: string) {
  if (code === "invalid") return "Enter a valid email and password.";
  if (code === "credentials") return "Email or password is incorrect.";
  if (code === "failed") return "Sign in failed. Please try again.";
  return "";
}

function safeNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/dashboard"));
  const invite = String(formData.get("invite") ?? "").trim();

  if (!email.includes("@") || password.length < 8) {
    redirect("/login?error=invalid");
  }

  let destination = invite ? "/invite/" + encodeURIComponent(invite) : next;
  try {
    const session = await authenticateAccount({ email, password });
    await setSession(session);
  } catch (error) {
    destination = error instanceof Error && error.message === "INVALID_CREDENTIALS"
      ? "/login?error=credentials"
      : "/login?error=failed";
  }

  redirect(destination);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; invite?: string; next?: string }>;
}) {
  const mode = getAuthMode();
  const params = searchParams ? await searchParams : undefined;
  const message = errorMessage(params?.error);
  const next = safeNext(params?.next ?? "/dashboard");

  return (
    <div className="auth-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">SECURE ACCESS</p>
      <h1>Welcome back</h1>
      <p className="muted large">Sign in to your marketing command center.</p>
      {mode === "preview" && <div className="preview-note">Preview mode · use the same browser and credentials you used on signup.</div>}
      <form className="auth-form" action={loginAction}>
        <input type="hidden" name="next" value={next} />
        {params?.invite && <input type="hidden" name="invite" value={params.invite} />}
        <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required placeholder="Minimum 8 characters" /></label>
        {message && <div className="error-box" role="alert">{message}</div>}
        <button className="btn auth-submit" type="submit">Sign in</button>
      </form>
      <p className="auth-switch">New here? <a href="/signup">Create an account</a></p>
    </div>
  );
}
