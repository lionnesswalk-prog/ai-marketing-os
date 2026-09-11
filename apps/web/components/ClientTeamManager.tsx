"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "../lib/auth";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  isCurrentUser: boolean;
};

type PendingInvite = {
  id: string;
  email: string;
  role: AppRole;
  expiresAt: string;
};

const labels: Record<AppRole, string> = {
  admin: "Admin",
  marketing_manager: "Marketing Manager",
  sales: "Sales",
  viewer: "Viewer",
};

export function ClientTeamManager({
  members,
  invites,
  canManage,
}: {
  members: Member[];
  invites: PendingInvite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function action(payload: Record<string, unknown>) {
    const response = await fetch("/api/workspaces/team/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to update team.");
    return body;
  }

  async function createInvite() {
    if (!email) return;
    setBusy("invite");
    setMessage("");
    setInviteLink("");
    try {
      const body = await action({ action: "invite", email, role });
      const full = window.location.origin + body.invite.invitePath;
      setInviteLink(full);
      setMessage("Invite created. Copy this link now and send it to the client or teammate.");
      setEmail("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invite.");
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Invite link copied.");
  }

  async function updateRole(userId: string, nextRole: AppRole) {
    setBusy(userId);
    setMessage("");
    try {
      await action({ action: "role", userId, role: nextRole });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update role.");
    } finally {
      setBusy("");
    }
  }

  async function remove(userId: string) {
    setBusy(userId);
    setMessage("");
    try {
      await action({ action: "remove", userId });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove member.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(inviteId: string) {
    setBusy(inviteId);
    setMessage("");
    try {
      await action({ action: "revoke", inviteId });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to revoke invite.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card team-card">
      <div className="section-head team-head">
        <div>
          <p className="eyebrow">CLIENT ACCESS</p>
          <h2>Team & permissions</h2>
        </div>
        <span className="pill">{members.length} members</span>
      </div>

      {canManage && (
        <div className="team-invite-form">
          <label>
            Invite email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="client@company.com" />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
              {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="btn" type="button" disabled={busy === "invite" || !email} onClick={createInvite}>
            {busy === "invite" ? "Creating…" : "Create invite"}
          </button>
        </div>
      )}

      {inviteLink && (
        <div className="team-invite-link">
          <input readOnly value={inviteLink} aria-label="Invite link" />
          <button className="btn secondary" type="button" onClick={copyInvite}>Copy link</button>
        </div>
      )}
      {message && <p className="team-message">{message}</p>}

      <div className="team-member-list">
        {members.map((member) => (
          <div className="team-member" key={member.userId}>
            <div className="team-member-copy">
              <strong>{member.name}{member.isCurrentUser ? " · You" : ""}</strong>
              <small>{member.email}</small>
            </div>
            {canManage && !member.isCurrentUser ? (
              <div className="team-member-actions">
                <select
                  value={member.role}
                  disabled={busy === member.userId}
                  onChange={(e) => updateRole(member.userId, e.target.value as AppRole)}
                >
                  {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button type="button" className="queue-action danger" disabled={busy === member.userId} onClick={() => remove(member.userId)}>Remove</button>
              </div>
            ) : (
              <span className="pill">{labels[member.role]}</span>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="pending-invites">
          <p className="eyebrow">PENDING INVITES</p>
          {invites.map((invite) => (
            <div className="team-member pending" key={invite.id}>
              <div className="team-member-copy">
                <strong>{invite.email}</strong>
                <small>{labels[invite.role]} · expires {new Date(invite.expiresAt).toLocaleDateString("en-IN")}</small>
              </div>
              {canManage && (
                <button type="button" className="queue-action danger" disabled={busy === invite.id} onClick={() => revoke(invite.id)}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
