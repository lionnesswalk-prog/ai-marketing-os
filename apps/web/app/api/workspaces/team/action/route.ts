import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../../lib/auth";
import {
  createWorkspaceInvite,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  updateWorkspaceMemberRole,
} from "../../../../../lib/workspace-invites";

const role = z.enum(["admin", "marketing_manager", "sales", "viewer"]);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().email(), role }),
  z.object({ action: z.literal("revoke"), inviteId: z.string().min(1) }),
  z.object({ action: z.literal("role"), userId: z.string().min(1), role }),
  z.object({ action: z.literal("remove"), userId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid team action." }, { status: 400 });

  try {
    if (parsed.data.action === "invite") {
      const invite = await createWorkspaceInvite(session, {
        email: parsed.data.email,
        role: parsed.data.role,
      });
      return NextResponse.json({
        ok: true,
        invite: {
          ...invite,
          invitePath: `/invite/${invite.token}`,
        },
      });
    }
    if (parsed.data.action === "revoke") {
      await revokeWorkspaceInvite(session, parsed.data.inviteId);
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "role") {
      await updateWorkspaceMemberRole(session, parsed.data.userId, parsed.data.role);
      return NextResponse.json({ ok: true });
    }
    await removeWorkspaceMember(session, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TEAM_ACTION_FAILED";
    const status = ["WORKSPACE_ADMIN_REQUIRED", "SELF_ROLE_CHANGE_FORBIDDEN", "SELF_REMOVE_FORBIDDEN"].includes(code) ? 403 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
