"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MetaSettingsView } from "../lib/platform-meta-settings";

export function MetaAppSettingsForm({ initial, callbackUrl }: { initial: MetaSettingsView; callbackUrl: string }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [appId, setAppId] = useState(initial.appId);
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const needsSecret = !settings.secretConfigured || appId.trim() !== settings.appId;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/platform/providers/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, appSecret, revision: settings.revision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save Meta settings.");
      setSettings(body.settings);
      setAppId(body.settings.appId);
      setAppSecret("");
      setMessage(body.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save Meta settings.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCallback() {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
    } catch {
      setError("Select and copy the callback URL below.");
    }
  }

  return (
    <section className="card meta-settings-card" id="meta-settings" aria-labelledby="meta-settings-title">
      <div className="meta-settings-heading">
        <div>
          <p className="eyebrow">FACEBOOK & INSTAGRAM</p>
          <h2 id="meta-settings-title">Meta app settings</h2>
          <p className="muted">Add your platform&apos;s Meta app once. Each client then connects their own accounts.</p>
        </div>
        <span className="pill">{settings.secretConfigured ? "Credentials configured" : "Setup needed"}</span>
      </div>

      <form onSubmit={save}>
        <fieldset className="meta-settings-fields" disabled={busy || !settings.storageReady}>
          <legend className="sr-only">Meta app credentials</legend>
          <label htmlFor="meta-app-id">
            App ID
            <input id="meta-app-id" name="appId" value={appId} onChange={(event) => setAppId(event.target.value)}
              type="text" inputMode="numeric" pattern="[0-9]{5,32}" maxLength={32} autoComplete="off" required
              placeholder="Enter your Meta App ID" aria-describedby="meta-credentials-help" />
          </label>
          <label htmlFor="meta-app-secret">
            App Secret
            <input id="meta-app-secret" name="appSecret" value={appSecret} onChange={(event) => setAppSecret(event.target.value)}
              type="password" minLength={16} maxLength={256} autoComplete="new-password" spellCheck={false} required={needsSecret}
              placeholder={needsSecret ? "Enter your Meta App Secret" : "Leave blank to keep the saved secret"}
              aria-describedby="meta-secret-help" />
          </label>
          <div className="meta-settings-help">
            <p id="meta-credentials-help">Find both values in <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Meta Developers</a> → your app → Settings → Basic.</p>
            <p id="meta-secret-help">Your secret is encrypted and never displayed after saving. Changing the App ID requires its matching secret and may require accounts to reconnect.</p>
          </div>
          <div className="meta-settings-actions">
            <button className="btn" type="submit">{busy ? "Saving…" : "Save Meta settings"}</button>
            {settings.secretConfigured && <a className="btn secondary" href="/connections">Open Connections</a>}
          </div>
        </fieldset>
      </form>

      {!settings.storageReady && <p className="profile-notice error" role="alert">Secure database storage is required before these settings can be saved.</p>}
      {message && <p className="profile-notice success" role="status">{message}</p>}
      {error && <p className="profile-notice error" role="alert">{error}</p>}

      <div className="meta-callback-block">
        <label htmlFor="meta-callback">OAuth redirect URL</label>
        <div className="meta-callback-row">
          <input id="meta-callback" type="text" value={callbackUrl} readOnly onFocus={(event) => event.target.select()} />
          <button className="btn secondary" type="button" onClick={copyCallback}>{copied ? "Copied" : "Copy URL"}</button>
        </div>
        <p className="muted">Add this exact URL to your Meta app&apos;s allowed OAuth redirect URLs. Meta permissions, app review and business verification are managed in Meta; saving credentials does not complete those steps.</p>
      </div>
    </section>
  );
}
