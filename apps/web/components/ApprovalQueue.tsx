"use client";

import { useState } from "react";
import type { ApprovalView } from "../lib/domain";

export function ApprovalQueue({ initial }: { initial: ApprovalView[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Approval update failed");
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: decision } : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {error && <div className="error-box">{error}</div>}
      {items.map((item) => (
        <article className="card" key={item.id}>
          <div className="row-between">
            <div>
              <div className="meta-row"><span className="pill">{item.campaignName}</span><span className={`health ${item.status === "pending" ? "watch" : "healthy"}`}>{item.status}</span></div>
              <h3>{item.action.replaceAll("_", " ")}{item.spendImpactPct ? ` · ${item.spendImpactPct}%` : ""}</h3>
              <p className="muted large">{item.reason}</p>
              <p className="muted">Model confidence: {Math.round(item.confidence * 100)}%</p>
            </div>
            {item.status === "pending" && (
              <div className="button-row">
                <button className="btn secondary" disabled={busy === item.id} onClick={() => decide(item.id, "rejected")}>Reject</button>
                <button className="btn" disabled={busy === item.id} onClick={() => decide(item.id, "approved")}>Approve</button>
              </div>
            )}
          </div>
        </article>
      ))}
      {!items.length && <div className="card"><p>No approval requests.</p></div>}
    </div>
  );
}
