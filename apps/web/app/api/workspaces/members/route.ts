import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import {
  createWorkspaceInvite,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  updateWorkspaceMemberRole,
} from "../../../../lib/workspace-members";

const roleSchema = z.enum(["admin", "marketing_manager", "sales", "viewer"]);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().email(), role: roleSchema }),
  z.object({ action: z.literal("update_role"), userId: z.string().min(1), role: roleSchema }),
  z.object({ action: z.literal("remove"), userId: z.string().min(1) }),
  z.object({ action: z.literal("revoke_invite"), inviteId: z.string().min(1) }),
]);

function friendly(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    DATABASE_MODE_REQUIRED: "Team access requires production database mode.",
    ADMIN_REQUIRED: "Only workspace admins can manage team access.",
    EMAIL_INVALID: "Enter a valid email address.",
    ROLE_INVALID: "Choose a valid role.",
    INVITE_SELF: "You already have access to this workspace.",
    ALREADY_MEMBER: "This person is already a workspace member.",
    INVITE_NOT_FOUND: "This invite is no longer active.",
    MEMBER_NOT_FOUND: "This member no longer has workspace access.",
    LAST_ADMIN: "At least one admin must remain in the workspace.",
    CANNOT_REMOVE_SELF: "You cannot remove your own workspace access.",
    BILLING_MEMBER_LIMIT: "This workspace has reached its plan member limit. Upgrade the plan or remove an unused seat before inviting another member.",
  };
  return messages[code] || code;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid team action." }, { status: 400 });

  try {
    if (parsed.data.action === "invite") {
      const invite = await createWorkspaceInvite(session, parsed.data);
      const origin = new URL(request.url).origin;
      return NextResponse.json({
        ok: true,
        invite: {
          ...invite,
          link: `${origin}/invite/${invite.token}`,
        },
      });
    }

    if (parsed.data.action === "update_role") {
      await updateWorkspaceMemberRole(session, parsed.data.userId, parsed.data.role);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "remove") {
      await removeWorkspaceMember(session, parsed.data.userId);
      return NextResponse.json({ ok: true });
    }

    await revokeWorkspaceInvite(session, parsed.data.inviteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 400 });
  }
}
