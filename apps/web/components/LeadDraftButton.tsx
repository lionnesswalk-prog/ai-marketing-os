"use client";

import { useState } from "react";

export function LeadDraftButton({ message }: { message: string }) {
  const [result, setResult] = useState<{ reply: string; missingFacts: string[]; requiresHuman: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function draft() {
    setBusy(true);
    try {
      const response = await fetch("/api/inquiries/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, verifiedFacts: [], brandName: "Lioness Walk" }),
      });
      const body = await response.json();
      if (response.ok) setResult(body.draft);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lead-draft">
      <button className="btn secondary" onClick={draft} disabled={busy}>{busy ? "Drafting…" : "Draft safe reply"}</button>
      {result && <div className="draft-box"><strong>AI draft</strong><p>{result.reply}</p>{result.missingFacts.length > 0 && <p className="muted">Needs verification: {result.missingFacts.join(", ")}</p>}{result.requiresHuman && <span className="approval-tag">Human handoff</span>}</div>}
    </div>
  );
}
