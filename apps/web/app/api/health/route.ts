import { NextResponse } from "next/server";
import { getPrisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseRequired = process.env.DATA_BACKEND === "postgres";
  let database: "ready" | "preview" | "unavailable" = databaseRequired ? "unavailable" : "preview";

  if (databaseRequired) {
    try {
      await getPrisma().workspace.count();
      database = "ready";
    } catch (error) {
      console.error("health database check failed", error);
    }
  }

  const ok = database !== "unavailable";
  return NextResponse.json(
    {
      ok,
      service: "ai-marketing-os",
      database,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
