import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { listLeads } from "../../../lib/repository";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listLeads());
}
