import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ai-marketing-os",
    dataBackend: process.env.DATA_BACKEND ?? "memory",
    aiMode: process.env.AI_MODE ?? "mock",
    timestamp: new Date().toISOString(),
  });
}
