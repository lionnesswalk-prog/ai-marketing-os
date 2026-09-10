import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { dashboardData } from "../../../lib/repository";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await dashboardData());
}
