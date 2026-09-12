"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global application error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0, background: "#111", color: "#fff" }}>
        <main style={{ maxWidth: 720, margin: "10vh auto", padding: 32 }}>
          <p style={{ letterSpacing: "0.16em", fontSize: 12 }}>AI MARKETING OS</p>
          <h1>We hit a runtime error.</h1>
          <p style={{ lineHeight: 1.6, opacity: 0.76 }}>
            Retry the application. If the problem remains, use the reference below when reviewing runtime logs.
          </p>
          {error.digest && <p style={{ opacity: 0.65 }}>Reference · {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "12px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}
          >
            Retry application
          </button>
        </main>
      </body>
    </html>
  );
}
