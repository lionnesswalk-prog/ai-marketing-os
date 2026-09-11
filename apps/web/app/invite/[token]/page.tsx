import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import {
  acceptWorkspaceInvite,
  getPublicInvite,
  registerFromWorkspaceInvite,
} from "../../../lib/workspace-members";

function inviteError(code?: string) {
  if (code === "invalid") return "This invite is invalid or no longer available.";
  if (code === "email") return "This invite belongs to a different email address.";
  if (code === "account") return "An account already exists for this email. Sign in to accept the invite.";
  if (code === "signup") return "Enter your name and a password of at least 8 characters.";
  return "";
}

async function acceptAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  const session = await getSession();
  if (!session) redirect("/login?invite=" + encodeURIComponent(token));

  try {
    await acceptWorkspaceInvite(session, token);
  } catch (error) {
    const code = error instanceof Error && error.message === "INVITE_EMAIL_MISMATCH" ? "email" : "invalid";
    redirect("/invite/" + encodeURIComponent(token) + "?error=" + code);
  }
  redirect("/dashboard");
}

async function registerAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    await registerFromWorkspaceInvite({ token, name, password });
  } catch (error) {
    const code = error instanceof Error && error.message === "ACCOUNT_EXISTS"
      ? "account"
      : error instanceof Error && error.message === "ACCOUNT_INPUT_INVALID"
        ? "signup"
        : "invalid";
    redirect("/invite/" + encodeURIComponent(token) + "?error=" + code);
  }
  redirect("/dashboard");
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const invite = await getPublicInvite(token);
  const session = await getSession();
  const error = inviteError(query?.error);

  if (!invite || invite.status !== "active") {
    return (
      <div className="auth-card invite-card">
        <div className="auth-logo">AI MARKETING OS</div>
        <p className="eyebrow">WORKSPACE INVITE</p>
        <h1>Invite unavailable</h1>
        <p className="muted large">This invite has expired, was revoked, or has already been accepted.</p>
        <a className="btn auth-submit invite-button-link" href="/login">Go to sign in</a>
      </div>
    );
  }

  const sameEmail = session?.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="auth-card invite-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">CLIENT WORKSPACE INVITE</p>
      <h1>Join {invite.brandName || invite.workspaceName}</h1>
      <p className="muted large">
        You were invited to <strong>{invite.workspaceName}</strong> as <strong>{invite.role.replaceAll("_", " ")}</strong>.
      </p>

      <div className="invite-summary">
        <div><span>Email</span><strong>{invite.email}</strong></div>
        <div><span>Role</span><strong>{invite.role.replaceAll("_", " ")}</strong></div>
        <div><span>Workspace</span><strong>{invite.workspaceName}</strong></div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}

      {session ? (
        sameEmail ? (
          <form action={acceptAction} className="auth-form">
            <input type="hidden" name="token" value={token} />
            <button className="btn auth-submit" type="submit">Accept workspace invite</button>
          </form>
        ) : (
          <div className="error-box">
            You are signed in as {session.email}. Sign out and use {invite.email} to accept this invite.
          </div>
        )
      ) : (
        <>
          <form action={registerAction} className="auth-form">
            <input type="hidden" name="token" value={token} />
            <label>Full name<input name="name" minLength={2} required autoComplete="name" placeholder="Your name" /></label>
            <label>Email<input value={invite.email} readOnly aria-readonly="true" /></label>
            <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Minimum 8 characters" /></label>
            <button className="btn auth-submit" type="submit">Create account & join</button>
          </form>
          <p className="auth-switch">
            Already have an account? <a href={"/login?invite=" + encodeURIComponent(token)}>Sign in to accept</a>
          </p>
        </>
      )}
    </div>
  );
}
