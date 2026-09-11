"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CampaignBuilder({
  brandName,
  canManage,
}: {
  brandName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"meta" | "google">("meta");
  const [dailyBudget, setDailyBudget] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createDraft() {
    if (!canManage) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, channel, dailyBudget }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to create campaign draft.");

      setName("");
      setMessage(body.message || "Campaign draft saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create campaign draft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col campaign-builder">
      <section className="card form-card">
        <p className="eyebrow">CAMPAIGN BUILDER</p>
        <h2>Create a paid-media draft</h2>
        <p className="muted">Create the internal campaign record first. Provider launch remains a separate, explicit step once the relevant Ads API is connected.</p>

        <label>Campaign name
          <input
            disabled={!canManage}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={brandName + " · Prospecting"}
            maxLength={120}
          />
        </label>
        <label>Channel
          <select disabled={!canManage} value={channel} onChange={(event) => setChannel(event.target.value as "meta" | "google")}>
            <option value="meta">Meta Ads</option>
            <option value="google">Google Ads</option>
          </select>
        </label>
        <label>Daily budget (INR)
          <input
            disabled={!canManage}
            type="number"
            min={100}
            max={10000000}
            value={dailyBudget}
            onChange={(event) => setDailyBudget(Number(event.target.value))}
          />
        </label>

        <button className="btn" type="button" disabled={!canManage || busy || name.trim().length < 2 || dailyBudget < 100} onClick={createDraft}>
          {busy ? "Saving…" : "Save campaign draft"}
        </button>
        {message && <div className="profile-notice success">{message}</div>}
        {error && <div className="profile-notice error">{error}</div>}
      </section>

      <aside className="card campaign-builder-safety">
        <p className="eyebrow">LAUNCH SAFETY</p>
        <h2>Draft does not spend money</h2>
        <div className="brand-ai-list">
          <div><span>01</span><strong>Plan</strong><p>Use AI Strategy to define objective, audience, creative angles and testing plan.</p></div>
          <div><span>02</span><strong>Draft</strong><p>Save channel and budget here as an internal campaign record.</p></div>
          <div><span>03</span><strong>Launch later</strong><p>Provider launch will require a real Ads API connection and explicit human approval.</p></div>
        </div>
        <a className="text-link" href="/strategy">Open AI Strategy →</a>
      </aside>
    </div>
  );
}
