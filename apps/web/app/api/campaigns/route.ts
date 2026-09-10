import { NextResponse } from "next/server";
import { listCampaigns } from "../../../lib/repository";

export async function GET() {
  return NextResponse.json(await listCampaigns());
}
