"use client";

import { useState } from "react";

export function OperationsRunButton({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/operations/scheduler/run", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to run the scheduler.");
      const parts = [
        body.claimed ? body.claimed + " claimed" : undefined,
        body.published ? body.published + " published" : undefined,
        body.processing ? body.processing + " processing" : undefined,
        body.failed ? body.failed + " failed" : undefined,
        body.recovered ? body.recovered + " stale recovered" : undefined,
      ].filter(Boolean);
      setMessage(parts.length ? parts.join(" · ") : "No due posts in this workspace.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run the scheduler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" type="button" onClick={run} disabled={disabled || busy}>
        {busy ? "Running…" : "Run scheduler now"}
      </button>
      {message && <div className="profile-notice success">{message}</div>}
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
