import { NextResponse } from "next/server";
import { getSession } from "../../../../../lib/auth";
import { listPinterestBoards } from "../../../../../lib/pinterest-integration";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const boards = await listPinterestBoards();
    return NextResponse.json({ ok: true, boards });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to load Pinterest boards.",
    }, { status: 400 });
  }
}
