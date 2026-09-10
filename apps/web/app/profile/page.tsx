import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import {
  changeAccountPassword,
  getAccountProfile,
  updateAccountProfile,
} from "../../lib/auth-service";

function roleLabel(role: string) {
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function initials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0];
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function notice(status?: string) {
  if (status === "saved") return { tone: "success", text: "Profile updated successfully." };
  if (status === "password") return { tone: "success", text: "Password changed successfully." };
  if (status === "exists") return { tone: "error", text: "That email address is already in use." };
  if (status === "invalid") return { tone: "error", text: "Please enter a valid name and email address." };
  if (status === "password-invalid") return { tone: "error", text: "Current password is incorrect." };
  if (status === "password-match") return { tone: "error", text: "New passwords do not match or are shorter than 8 characters." };
  if (status === "failed") return { tone: "error", text: "Something went wrong. Please try again." };
  return null;
}

async function updateProfileAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (name.length < 2 || !email.includes("@")) redirect("/profile?status=invalid");

  let destination = "/profile?status=saved";
  try {
    await updateAccountProfile(session, { name, email });
  } catch (error) {
    destination = error instanceof Error && error.message === "ACCOUNT_EXISTS"
      ? "/profile?status=exists"
      : "/profile?status=failed";
  }
  redirect(destination);
}

async function changePasswordAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect("/profile?status=password-match");
  }

  let destination = "/profile?status=password";
  try {
    await changeAccountPassword(session, { currentPassword, newPassword });
  } catch (error) {
    destination = error instanceof Error && error.message === "INVALID_PASSWORD"
      ? "/profile?status=password-invalid"
      : "/profile?status=failed";
  }
  redirect(destination);
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const profile = await getAccountProfile(session);
  const params = searchParams ? await searchParams : undefined;
  const message = notice(params?.status);

  return (
    <div className="profile-page">
      <div className="page-head profile-heading">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h1>Your profile</h1>
          <p className="muted large">Manage the identity and security settings attached to your marketing workspace.</p>
        </div>
        <span className="pill accent">Secure account</span>
      </div>

      {message && <div className={`profile-notice ${message.tone}`}>{message.text}</div>}

      <div className="profile-grid">
        <aside className="card profile-summary">
          <div className="profile-avatar large-avatar">{initials(profile.name, profile.email)}</div>
          <h2>{profile.name}</h2>
          <p className="muted profile-email">{profile.email}</p>
          <div className="profile-meta-list">
            <div><span>Role</span><strong>{roleLabel(profile.role)}</strong></div>
            <div><span>Workspace</span><strong>{profile.workspaceName}</strong></div>
            <div><span>Status</span><strong className="profile-active"><i /> Active</strong></div>
          </div>
        </aside>

        <div className="profile-panels">
          <section className="card profile-panel">
            <div className="profile-panel-head">
              <div><p className="eyebrow">PERSONAL INFORMATION</p><h2>Account details</h2></div>
              <span className="profile-section-number">01</span>
            </div>
            <form action={updateProfileAction} className="profile-form">
              <label>Full name<input name="name" defaultValue={profile.name} minLength={2} required autoComplete="name" /></label>
              <label>Email address<input name="email" type="email" defaultValue={profile.email} required autoComplete="email" /></label>
              <div className="profile-readonly-grid">
                <label>Role<input value={roleLabel(profile.role)} readOnly aria-readonly="true" /></label>
                <label>Workspace<input value={profile.workspaceName} readOnly aria-readonly="true" /></label>
              </div>
              <div className="profile-actions"><button className="btn" type="submit">Save changes</button></div>
            </form>
          </section>

          <section className="card profile-panel">
            <div className="profile-panel-head">
              <div><p className="eyebrow">SECURITY</p><h2>Change password</h2></div>
              <span className="profile-section-number">02</span>
            </div>
            <p className="muted">Use at least 8 characters and choose a password you do not use elsewhere.</p>
            <form action={changePasswordAction} className="profile-form password-form">
              <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
              <div className="profile-readonly-grid">
                <label>New password<input name="newPassword" type="password" minLength={8} required autoComplete="new-password" /></label>
                <label>Confirm password<input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" /></label>
              </div>
              <div className="profile-actions"><button className="btn secondary" type="submit">Update password</button></div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
