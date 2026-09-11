import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import { switchWorkspace } from "../../../../lib/workspaces";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Workspace is required." }, { status: 400 });

  try {
    const next = await switchWorkspace(session, parsed.data.workspaceId);
    return NextResponse.json({ ok: true, workspaceId: next.workspaceId, role: next.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WORKSPACE_ACCESS_DENIED";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
