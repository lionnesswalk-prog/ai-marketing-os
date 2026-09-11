import { NextResponse } from "next/server";
import { canManageMarketing, getSession } from "../../../../../lib/auth";
import { recordAuditEvent } from "../../../../../lib/audit";
import { runProviderDiagnostics } from "../../../../../lib/provider-diagnostics";

export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageMarketing(session.role)) {
    return NextResponse.json({ error: "Your role cannot run provider diagnostics." }, { status: 403 });
  }

  const results = await runProviderDiagnostics();
  const summary = {
    ready: results.filter((item) => item.status === "ready").length,
    disconnected: results.filter((item) => item.status === "disconnected").length,
    error: results.filter((item) => item.status === "error").length,
  };

  await recordAuditEvent({
    workspaceId: session.workspaceId,
    actorType: session.platformAdmin ? "platform_admin" : "workspace_user",
    actorId: session.userId,
    action: "provider_diagnostics_run",
    entityType: "IntegrationDiagnostics",
    payload: summary,
  });

  return NextResponse.json({ ok: true, summary, results });
}
