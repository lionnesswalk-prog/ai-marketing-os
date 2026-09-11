"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TikTokStatusButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStatus() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/social/tiktok/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to refresh TikTok status.");
      setMessage(body.status === "published"
        ? "Published"
        : body.status === "failed"
          ? (body.failReason ? `Failed · ${body.failReason}` : "Failed")
          : "Still processing");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="tiktok-status-control">
      <button type="button" onClick={refreshStatus} disabled={busy}>
        {busy ? "Checking…" : "Refresh TikTok status"}
      </button>
      {message && <small>{message}</small>}
    </span>
  );
}
