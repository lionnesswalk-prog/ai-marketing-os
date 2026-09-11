"use client";

import { useState } from "react";
import type { WorkspaceOption } from "../lib/workspaces";

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: WorkspaceOption[];
}) {
  const current = workspaces.find((item) => item.current) || workspaces[0];
  const [busy, setBusy] = useState(false);

  async function change(workspaceId: string) {
    if (!workspaceId || workspaceId === current?.id) return;
    setBusy(true);
    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) throw new Error("Unable to switch workspace.");
      window.location.href = "/dashboard";
    } catch {
      setBusy(false);
    }
  }

  if (!current) return null;

  return (
    <div className="workspace-switcher">
      <span className="workspace-switcher-label">ACTIVE CLIENT</span>
      <div className="workspace-switcher-control">
        <span className="workspace-switcher-dot" />
        <select
          value={current.id}
          disabled={busy}
          onChange={(event) => change(event.target.value)}
          aria-label="Active client workspace"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.brandName || workspace.name}
            </option>
          ))}
        </select>
      </div>
      <small>{current.name}</small>
    </div>
  );
}
