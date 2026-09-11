"use client";

import { useState } from "react";

export function LeadDraftButton({ message }: { message: string }) {
  const [result, setResult] = useState<{ reply: string; missingFacts: string[]; requiresHuman: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/inquiries/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, verifiedFacts: [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to draft reply.");
      setResult(body.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to draft reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lead-draft">
      <button className="btn secondary" onClick={draft} disabled={busy}>{busy ? "Drafting…" : "Draft safe reply"}</button>
      {error && <div className="error-box">{error}</div>}
      {result && <div className="draft-box"><strong>AI draft</strong><p>{result.reply}</p>{result.missingFacts.length > 0 && <p className="muted">Needs verification: {result.missingFacts.join(", ")}</p>}{result.requiresHuman && <span className="approval-tag">Human handoff</span>}</div>}
    </div>
  );
}
