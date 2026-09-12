import { NextResponse } from "next/server";
import { getPrisma } from "../../../lib/prisma";
import { getRuntimeHealthSnapshot } from "../../../lib/runtime-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = getRuntimeHealthSnapshot();
  const databaseRequired = runtime.dataBackend === "postgres";
  let database: "ready" | "preview" | "unavailable" = databaseRequired ? "unavailable" : "preview";

  if (databaseRequired) {
    try {
      await getPrisma().workspace.count();
      database = "ready";
    } catch (error) {
      console.error("health database check failed", error);
    }
  }

  const coreReady =
    database !== "unavailable" &&
    runtime.checks.authSecret &&
    runtime.checks.databaseConfigured &&
    runtime.checks.integrationEncryption &&
    runtime.checks.tenantIsolation &&
    runtime.checks.aiRuntime;

  return NextResponse.json(
    {
      ok: coreReady,
      service: "ai-marketing-os",
      status: coreReady ? "ready" : "degraded",
      database,
      environment: runtime.environment,
      commit: runtime.commit,
      checks: runtime.checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: coreReady ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
