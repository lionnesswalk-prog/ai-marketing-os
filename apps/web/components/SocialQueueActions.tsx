"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SocialQueueActions({
  postId,
  status,
  scheduledAt,
}: {
  postId: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduledAt?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newTime, setNewTime] = useState(() => {
    if (!scheduledAt) return "";
    const date = new Date(scheduledAt);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  });
  const [message, setMessage] = useState("");

  async function act(action: "retry" | "cancel" | "reschedule") {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch("/api/social/posts/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          postId,
          ...(action === "reschedule" && newTime
            ? { scheduledAt: new Date(newTime).toISOString() }
            : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok && response.status !== 207) {
        throw new Error(body.error ?? "Unable to update post.");
      }
      setMessage(body.message ?? "Updated.");
      setShowReschedule(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update post.");
    } finally {
      setBusy(null);
    }
  }

  if (!["failed", "scheduled"].includes(status)) return null;

  return (
    <div className="queue-actions-wrap">
      <div className="queue-actions">
        {status === "failed" && (
          <button className="queue-action primary" type="button" disabled={busy !== null} onClick={() => act("retry")}>
            {busy === "retry" ? "Retrying…" : "Retry now"}
          </button>
        )}
        <button className="queue-action" type="button" disabled={busy !== null} onClick={() => setShowReschedule((value) => !value)}>
          Reschedule
        </button>
        {status === "scheduled" && (
          <button className="queue-action danger" type="button" disabled={busy !== null} onClick={() => act("cancel")}>
            {busy === "cancel" ? "Cancelling…" : "Cancel schedule"}
          </button>
        )}
      </div>

      {showReschedule && (
        <div className="queue-reschedule">
          <input
            type="datetime-local"
            value={newTime}
            onChange={(event) => setNewTime(event.target.value)}
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
          />
          <button className="queue-action primary" type="button" disabled={busy !== null || !newTime} onClick={() => act("reschedule")}>
            {busy === "reschedule" ? "Saving…" : "Save time"}
          </button>
        </div>
      )}

      {message && <small className="queue-action-message">{message}</small>}
    </div>
  );
}
