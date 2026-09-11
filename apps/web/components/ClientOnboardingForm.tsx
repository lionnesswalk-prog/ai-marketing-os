"use client";

import { useState } from "react";

type Role = "admin" | "marketing_manager" | "sales" | "viewer";

export function ClientOnboardingForm() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerRole, setOwnerRole] = useState<Role>("admin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function createClient() {
    setBusy(true);
    setMessage("");
    setError("");
    setInviteLink("");

    try {
      const response = await fetch("/api/platform/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceName, brandName, ownerEmail, ownerRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to create client.");

      setMessage(body.message || "Client created.");
      if (body.warning) setError("Workspace created. Invite warning: " + body.warning);
      if (body.invite?.link) setInviteLink(body.invite.link);
      setWorkspaceName("");
      setBrandName("");
      setOwnerEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create client.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Client invite link copied.");
  }

  return (
    <section className="card client-create-card">
      <p className="eyebrow">ADD CLIENT</p>
      <h2>Workspace + owner access</h2>
      <p className="muted">Create an isolated client workspace. Add the owner's email now to generate a secure 7-day invitation in the same step.</p>

      <div className="client-onboarding-form">
        <label>
          Client / workspace name
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} minLength={2} placeholder="Acme Fashion" />
        </label>
        <label>
          Brand name
          <input value={brandName} onChange={(event) => setBrandName(event.target.value)} minLength={2} placeholder="Acme" />
        </label>
        <label>
          Client owner email · optional
          <input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@client.com" />
        </label>
        <label>
          Initial client role
          <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as Role)} disabled={!ownerEmail}>
            <option value="admin">Admin</option>
            <option value="marketing_manager">Marketing Manager</option>
            <option value="sales">Sales</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <button
          className="btn"
          type="button"
          disabled={busy || workspaceName.trim().length < 2 || brandName.trim().length < 2}
          onClick={createClient}
        >
          {busy ? "Creating…" : ownerEmail ? "Create client & invite" : "Create client workspace"}
        </button>
      </div>

      {inviteLink && (
        <div className="client-invite-result">
          <div>
            <span>SECURE CLIENT INVITE</span>
            <input value={inviteLink} readOnly aria-readonly="true" />
          </div>
          <button className="btn secondary" type="button" onClick={copyInvite}>Copy invite</button>
          <a className="btn secondary client-open-link" href="/dashboard">Open client</a>
        </div>
      )}
      {!inviteLink && message && <a className="text-link" href="/dashboard">Open new client →</a>}
      {message && <div className="profile-notice success">{message}</div>}
      {error && <div className="profile-notice error">{error}</div>}
    </section>
  );
}
