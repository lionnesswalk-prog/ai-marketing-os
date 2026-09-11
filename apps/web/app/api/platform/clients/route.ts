import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import { createClientWorkspace, switchWorkspace } from "../../../../lib/workspaces";
import { createWorkspaceInvite } from "../../../../lib/workspace-members";

const schema = z.object({
  workspaceName: z.string().trim().min(2).max(120),
  brandName: z.string().trim().min(2).max(120),
  ownerEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
  ownerRole: z.enum(["admin", "marketing_manager", "sales", "viewer"]).default("admin"),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.platformAdmin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid client workspace, brand and optional owner email." }, { status: 400 });

  const ownerEmail = parsed.data.ownerEmail?.trim().toLowerCase() || "";
  if (ownerEmail && ownerEmail === session.email.toLowerCase()) {
    return NextResponse.json({ error: "The platform administrator already receives workspace access automatically. Use the client's email instead." }, { status: 400 });
  }

  try {
    const created = await createClientWorkspace(session, {
      workspaceName: parsed.data.workspaceName,
      brandName: parsed.data.brandName,
    });
    const clientSession = await switchWorkspace(session, created.id);

    let invite: { email: string; role: string; link: string; expiresAt: string } | undefined;
    let warning: string | undefined;

    if (ownerEmail) {
      try {
        const createdInvite = await createWorkspaceInvite(clientSession, {
          email: ownerEmail,
          role: parsed.data.ownerRole,
        });
        invite = {
          email: createdInvite.email,
          role: createdInvite.role,
          expiresAt: createdInvite.expiresAt,
          link: new URL(request.url).origin + "/invite/" + createdInvite.token,
        };
      } catch (error) {
        warning = error instanceof Error ? error.message : "Workspace created, but the owner invite could not be generated.";
      }
    }

    return NextResponse.json({
      ok: true,
      client: created,
      invite,
      warning,
      message: invite
        ? "Client workspace created and owner invite is ready."
        : "Client workspace created. You can invite members later from Team.",
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "DATABASE_MODE_REQUIRED") {
      return NextResponse.json({ error: "Production database mode is required to create client workspaces." }, { status: 409 });
    }
    if (code === "WORKSPACE_CREATE_FORBIDDEN") {
      return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to create the client workspace." }, { status: 500 });
  }
}
