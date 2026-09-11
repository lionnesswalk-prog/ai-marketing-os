"use client";

import { useState } from "react";

type Diagnostic = {
  id: string;
  name: string;
  status: "ready" | "disconnected" | "error";
  detail: string;
  checkedAt: string;
  latencyMs: number;
};

export function ProviderDiagnosticsButton() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Diagnostic[]>([]);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/operations/providers/check", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Provider diagnostics failed.");
      setResults(body.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider diagnostics failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn secondary" type="button" onClick={run} disabled={busy}>
        {busy ? "Checking providers…" : "Run live provider check"}
      </button>
      {error && <div className="error-box">{error}</div>}
      {results.length > 0 && (
        <div className="stack">
          {results.map((item) => (
            <div className="card" key={item.id}>
              <div className="row-between">
                <strong>{item.name}</strong>
                <span className={"health " + (item.status === "ready" ? "healthy" : item.status === "disconnected" ? "watch" : "needs_action")}>
                  {item.status}
                </span>
              </div>
              <p className="muted">{item.detail}</p>
              <small className="muted">{item.latencyMs} ms</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
