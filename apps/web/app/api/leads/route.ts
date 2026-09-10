import { NextResponse } from "next/server";
import { listLeads } from "../../../lib/repository";

export async function GET() {
  return NextResponse.json(await listLeads());
}
