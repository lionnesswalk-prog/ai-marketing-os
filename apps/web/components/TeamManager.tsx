"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppRole } from "../lib/auth";
import type { WorkspaceInviteView, WorkspaceMemberView } from "../lib/workspace-members";

const roles: Array<{ value: AppRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "sales", label: "Sales" },
  { value: "viewer", label: "Viewer" },
];

export function TeamManager({
  members,
  invites,
  canManage,
}: {
  members: WorkspaceMemberView[];
  invites: WorkspaceInviteView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("viewer");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function call(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update team access.");
      return body;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update team access.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function invite() {
    const body = await call({ action: "invite", email, role: inviteRole }, "invite");
    if (!body?.invite) return;
    setInviteLink(body.invite.link);
    setEmail("");
    setMessage("Invite ready. Copy the secure link and send it to the client or team member.");
    router.refresh();
  }

  async function updateRole(userId: string, role: AppRole) {
    const body = await call({ action: "update_role", userId, role }, `role-${userId}`);
    if (body?.ok) {
      setMessage("Role updated.");
      router.refresh();
    }
  }

  async function remove(userId: string) {
    const body = await call({ action: "remove", userId }, `remove-${userId}`);
    if (body?.ok) {
      setMessage("Workspace access revoked.");
      router.refresh();
    }
  }

  async function revokeInvite(inviteId: string) {
    const body = await call({ action: "revoke_invite", inviteId }, `invite-${inviteId}`);
    if (body?.ok) {
      setMessage("Invite revoked.");
      router.refresh();
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Invite link copied.");
  }

  return (
    <div className="team-layout">
      {canManage && (
        <section className="card team-invite-card">
          <p className="eyebrow">INVITE ACCESS</p>
          <h2>Add team member</h2>
          <p className="muted">Invite a client or teammate into only this workspace. The secure link expires in 7 days.</p>
          <div className="team-invite-form">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="client@company.com" />
            </label>
            <label>
              Role
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AppRole)}>
                {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <button className="btn" type="button" disabled={busy !== null || !email.includes("@")} onClick={invite}>
              {busy === "invite" ? "Creating…" : "Create invite"}
            </button>
          </div>

          {inviteLink && (
            <div className="team-invite-link">
              <input value={inviteLink} readOnly aria-label="Invite link" />
              <button className="btn secondary" type="button" onClick={copyInvite}>Copy link</button>
            </div>
          )}
          {message && <p className="team-message">{message}</p>}
        </section>
      )}

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">WORKSPACE MEMBERS</p>
            <h2>{members.length} people with access</h2>
          </div>
        </div>

        <div className="team-member-list">
          {members.map((member) => (
            <article className="card team-member-card" key={member.userId}>
              <div className="team-member-person">
                <div className="team-avatar">{(member.name || member.email).slice(0, 2).toUpperCase()}</div>
                <div>
                  <h3>{member.name || member.email.split("@")[0]} {member.currentUser && <span className="pill accent">You</span>}</h3>
                  <p>{member.email}</p>
                </div>
              </div>
              <div className="team-member-actions">
                {canManage ? (
                  <select
                    value={member.role}
                    disabled={busy !== null}
                    onChange={(event) => updateRole(member.userId, event.target.value as AppRole)}
                  >
                    {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                ) : (
                  <span className="pill">{roles.find((item) => item.value === member.role)?.label || member.role}</span>
                )}
                {canManage && !member.currentUser && (
                  <button className="team-remove" type="button" disabled={busy !== null} onClick={() => remove(member.userId)}>
                    {busy === `remove-${member.userId}` ? "Removing…" : "Revoke"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {invites.length > 0 && (
        <section>
          <div className="section-head">
            <div><p className="eyebrow">PENDING</p><h2>Invitations</h2></div>
          </div>
          <div className="team-member-list">
            {invites.map((invite) => (
              <article className="card team-member-card" key={invite.id}>
                <div className="team-member-person">
                  <div className="team-avatar pending">IN</div>
                  <div>
                    <h3>{invite.email}</h3>
                    <p>Expires {new Date(invite.expiresAt).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
                <div className="team-member-actions">
                  <span className="pill">{roles.find((item) => item.value === invite.role)?.label || invite.role}</span>
                  {canManage && (
                    <button className="team-remove" type="button" disabled={busy !== null} onClick={() => revokeInvite(invite.id)}>
                      Revoke invite
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
