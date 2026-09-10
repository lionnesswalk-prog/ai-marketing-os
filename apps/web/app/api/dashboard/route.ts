import { NextResponse } from "next/server";
import { dashboardData } from "../../../lib/repository";

export async function GET() {
  return NextResponse.json(await dashboardData());
}
