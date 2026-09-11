"use client";

import { useMemo, useState } from "react";
import type { BrandProfile } from "../lib/brand-profile";

export function BrandProfileEditor({
  initialProfile,
  canEdit,
}: {
  initialProfile: BrandProfile;
  canEdit: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const completeness = useMemo(() => {
    const fields = [
      profile.name,
      profile.industry,
      profile.audience,
      profile.positioning,
      profile.voice,
      profile.proofPoints,
      profile.avoid,
    ];
    return Math.round((fields.filter((value) => value.trim().length > 0).length / fields.length) * 100);
  }, [profile]);

  function field<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/brand-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          website: profile.website,
          industry: profile.industry,
          audience: profile.audience,
          positioning: profile.positioning,
          voice: profile.voice,
          proofPoints: profile.proofPoints,
          avoid: profile.avoid,
          notes: profile.notes,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save brand profile.");
      setProfile(body.profile);
      setMessage("Brand profile saved. AI Strategy, Social and Inquiry now use this context automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save brand profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-profile-layout">
      <section className="card brand-profile-form">
        <div className="brand-profile-section-head">
          <div>
            <p className="eyebrow">CORE IDENTITY</p>
            <h2>Brand foundation</h2>
          </div>
          <span className="pill accent">{completeness}% complete</span>
        </div>

        <div className="brand-profile-grid">
          <label>Brand name<input disabled={!canEdit} value={profile.name} onChange={(e) => field("name", e.target.value)} /></label>
          <label>Website<input disabled={!canEdit} type="url" value={profile.website} onChange={(e) => field("website", e.target.value)} placeholder="https://yourbrand.com" /></label>
          <label>Industry / category<input disabled={!canEdit} value={profile.industry} onChange={(e) => field("industry", e.target.value)} placeholder="Luxury fashion, SaaS, hospitality..." /></label>
        </div>

        <label>Core audience<textarea disabled={!canEdit} rows={4} value={profile.audience} onChange={(e) => field("audience", e.target.value)} placeholder="Who the brand is for, their needs, motivations and buying context." /></label>
        <label>Positioning<textarea disabled={!canEdit} rows={4} value={profile.positioning} onChange={(e) => field("positioning", e.target.value)} placeholder="What makes the brand meaningfully different and why the right customer should care." /></label>
        <label>Brand voice<textarea disabled={!canEdit} rows={4} value={profile.voice} onChange={(e) => field("voice", e.target.value)} placeholder="Clear, composed, expert, warm, direct..." /></label>
        <label>Verified proof points · one per line<textarea disabled={!canEdit} rows={5} value={profile.proofPoints} onChange={(e) => field("proofPoints", e.target.value)} placeholder={"Award-winning support\nMade in-house\n30-day return policy"} /></label>
        <label>Avoid · one per line<textarea disabled={!canEdit} rows={4} value={profile.avoid} onChange={(e) => field("avoid", e.target.value)} placeholder={"Unsupported claims\nFake urgency\nGeneric filler"} /></label>
        <label>Additional AI context<textarea disabled={!canEdit} rows={5} value={profile.notes} onChange={(e) => field("notes", e.target.value)} placeholder="Products, seasonality, market constraints, terminology or other useful context." /></label>

        {message && <div className="profile-notice success">{message}</div>}
        {error && <div className="profile-notice error">{error}</div>}
        {canEdit ? (
          <button className="btn" type="button" disabled={busy || profile.name.trim().length < 2} onClick={save}>
            {busy ? "Saving…" : "Save brand profile"}
          </button>
        ) : (
          <div className="brand-readonly-note">Read-only access · Admin or Marketing Manager can edit brand context.</div>
        )}
      </section>

      <aside className="card brand-ai-card">
        <p className="eyebrow">AI CONTEXT</p>
        <h2>Used automatically</h2>
        <p className="muted">This profile is injected server-side into AI Strategy, Social Content and Inquiry drafting. Users do not need to paste brand instructions into every prompt.</p>
        <div className="brand-ai-list">
          <div><span>01</span><strong>Strategy</strong><p>Audience, positioning and proof influence campaign angles and assumptions.</p></div>
          <div><span>02</span><strong>Social</strong><p>Voice, proof points and avoid-list guide hooks, captions and CTAs.</p></div>
          <div><span>03</span><strong>Inquiry</strong><p>Replies inherit brand identity while refusing to invent unverified facts.</p></div>
        </div>
        <div className="brand-ai-safety"><strong>Tenant safe</strong><span>AI context is loaded from the active workspace brand only.</span></div>
      </aside>
    </div>
  );
}
