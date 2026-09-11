import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import {
  acceptWorkspaceInvite,
  getWorkspaceInvite,
  registerFromWorkspaceInvite,
} from "../../../lib/workspace-invites";

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
    await registerFromWorkspaceInvite(token, { name, password });
  } catch (error) {
    const code = error instanceof Error && error.message === "ACCOUNT_EXISTS_USE_LOGIN"
      ? "account"
      : error instanceof Error && error.message === "INVITE_SIGNUP_INVALID"
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
  const invite = await getWorkspaceInvite(token);
  const session = await getSession();
  const error = inviteError(query?.error);

  if (!invite || !invite.active) {
    return (
      <div className="auth-card">
        <div className="auth-logo">AI MARKETING OS</div>
        <p className="eyebrow">WORKSPACE INVITE</p>
        <h1>Invite unavailable</h1>
        <p className="muted large">This invite has expired, was revoked, or has already been accepted.</p>
        <a className="btn auth-submit" href="/login">Go to sign in</a>
      </div>
    );
  }

  const sameEmail = session && session.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="auth-card invite-card">
      <div className="auth-logo">AI MARKETING OS</div>
      <p className="eyebrow">CLIENT WORKSPACE INVITE</p>
      <h1>Join {invite.workspaceName}</h1>
      <p className="muted large">You were invited as <strong>{invite.role.replaceAll("_", " ")}</strong> using {invite.email}.</p>

      {error && <div className="error-box" role="alert">{error}</div>}

      {session ? (
        sameEmail ? (
          <form action={acceptAction} className="auth-form">
            <input type="hidden" name="token" value={token} />
            <button className="btn auth-submit" type="submit">Accept invite</button>
          </form>
        ) : (
          <div className="error-box">You are signed in as {session.email}. Sign out and use {invite.email} to accept this invite.</div>
        )
      ) : (
        <>
          <form action={registerAction} className="auth-form">
            <input type="hidden" name="token" value={token} />
            <label>Full name<input name="name" minLength={2} required autoComplete="name" /></label>
            <label>Email<input value={invite.email} readOnly aria-readonly="true" /></label>
            <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
            <button className="btn auth-submit" type="submit">Create account & join</button>
          </form>
          <p className="auth-switch">Already have an account? <a href={"/login?invite=" + encodeURIComponent(token)}>Sign in to accept</a></p>
        </>
      )}
    </div>
  );
}
