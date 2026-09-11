import type { AppSession } from "./auth";
import { getCurrentBrandProfile } from "./brand-profile";
import { getPrisma } from "./prisma";

export type WorkspaceSetupStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  optional: boolean;
  href: string;
  action: string;
};

export type WorkspaceReadiness = {
  progress: number;
  completedRequired: number;
  totalRequired: number;
  steps: WorkspaceSetupStep[];
};

function databaseReady() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

export async function getWorkspaceReadiness(session: AppSession): Promise<WorkspaceReadiness> {
  const profile = await getCurrentBrandProfile(session);
  const brandReady = [profile.industry, profile.audience, profile.positioning, profile.voice]
    .every((value) => value.trim().length > 0);

  let connected = 0;
  let posts = 0;
  let members = 1;
  let pendingInvites = 0;
  let campaigns = 0;

  if (databaseReady()) {
    const prisma = getPrisma();
    [connected, posts, members, pendingInvites, campaigns] = await Promise.all([
      prisma.integrationConnection.count({
        where: { brandId: profile.brandId, status: "connected" },
      }),
      prisma.socialPost.count({
        where: { brandId: profile.brandId },
      }),
      prisma.workspaceAccess.count({
        where: { workspaceId: session.workspaceId },
      }),
      prisma.workspaceInvite.count({
        where: {
          workspaceId: session.workspaceId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.campaign.count({
        where: { brandId: profile.brandId },
      }),
    ]);
  }

  const steps: WorkspaceSetupStep[] = [
    {
      key: "brand",
      title: "Complete Brand Profile",
      detail: brandReady
        ? "Audience, positioning, category and voice are ready for AI."
        : "Add audience, positioning, category and voice so AI has trusted brand context.",
      done: brandReady,
      optional: false,
      href: "/brand",
      action: brandReady ? "Review profile" : "Complete profile",
    },
    {
      key: "social",
      title: "Connect a Social Channel",
      detail: connected > 0
        ? `${connected} provider connection${connected === 1 ? "" : "s"} active in this workspace.`
        : "Connect at least one supported provider through the Social Hub.",
      done: connected > 0,
      optional: false,
      href: "/social",
      action: connected > 0 ? "Manage channels" : "Connect channel",
    },
    {
      key: "content",
      title: "Create First Content",
      detail: posts > 0
        ? `${posts} social post${posts === 1 ? "" : "s"} created in this workspace.`
        : "Save, schedule or publish the first workspace-scoped social post.",
      done: posts > 0,
      optional: false,
      href: "/social",
      action: posts > 0 ? "Open content" : "Create content",
    },
    {
      key: "team",
      title: "Add Team Access",
      detail: members > 1
        ? `${members} members have workspace access.`
        : pendingInvites > 0
          ? `${pendingInvites} secure invite${pendingInvites === 1 ? "" : "s"} pending.`
          : "Invite a client owner or teammate and assign the right role.",
      done: members > 1 || pendingInvites > 0,
      optional: true,
      href: "/team",
      action: members > 1 || pendingInvites > 0 ? "Manage team" : "Invite member",
    },
    {
      key: "campaigns",
      title: "Bring In Paid Campaign Data",
      detail: campaigns > 0
        ? `${campaigns} campaign${campaigns === 1 ? "" : "s"} available for diagnostics.`
        : "Optional: add or import paid campaign data when this workspace starts advertising.",
      done: campaigns > 0,
      optional: true,
      href: campaigns > 0 ? "/campaigns" : "/strategy",
      action: campaigns > 0 ? "Open campaigns" : "Plan campaign",
    },
  ];

  const required = steps.filter((step) => !step.optional);
  const completedRequired = required.filter((step) => step.done).length;

  return {
    progress: Math.round((completedRequired / required.length) * 100),
    completedRequired,
    totalRequired: required.length,
    steps,
  };
}
