"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("application route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 760, margin: "48px auto", padding: 32 }}>
      <p className="eyebrow">RECOVERY MODE</p>
      <h1>Something interrupted this page.</h1>
      <p className="muted large">
        This page could not finish loading. Retry it first; if the problem continues, return to the dashboard or open Operations to review system status.
      </p>
      {error.digest && <p className="muted">Reference · {error.digest}</p>}
      <div className="social-actions">
        <button className="btn" type="button" onClick={reset}>Retry page</button>
        <a className="btn secondary" href="/dashboard">Back to dashboard</a>
        <a className="text-link" href="/operations">Open Operations →</a>
      </div>
    </div>
  );
}
