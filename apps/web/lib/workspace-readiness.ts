import type { AppSession } from "./auth";
import { getCurrentBrandProfile } from "./brand-profile";
import { getPrisma } from "./prisma";
import { isDatabaseMode } from "./runtime-mode";

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
  return isDatabaseMode();
}

export async function getWorkspaceReadiness(session: AppSession): Promise<WorkspaceReadiness> {
  const profile = await getCurrentBrandProfile(session);
  const brandReady = [profile.industry, profile.market, profile.businessModel, profile.primaryGoal, profile.audience, profile.positioning, profile.voice]
    .every((value) => value.trim().length > 0);

  let connected = 0;
  let posts = 0;
  let members = 1;
  let pendingInvites = 0;
  let campaigns = 0;
  let verifiedKnowledge = 0;

  if (databaseReady()) {
    const prisma = getPrisma();
    [connected, posts, members, pendingInvites, campaigns, verifiedKnowledge] = await Promise.all([
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
      prisma.knowledgeItem.count({
        where: { brandId: profile.brandId, verified: true },
      }),
    ]);
  }

  const steps: WorkspaceSetupStep[] = [
    {
      key: "brand",
      title: "Complete Brand Profile",
      detail: brandReady
        ? "Industry, market, business model, audience, positioning and voice are ready for AI."
        : "Add industry, market, business model, audience, positioning and voice so AI has the right operating context.",
      done: brandReady,
      optional: false,
      href: "/brand",
      action: brandReady ? "Review profile" : "Complete profile",
    },
    {
      key: "knowledge",
      title: "Add Verified Knowledge",
      detail: verifiedKnowledge > 0
        ? `${verifiedKnowledge} verified knowledge item${verifiedKnowledge === 1 ? "" : "s"} available to AI.`
        : "Add at least one verified product, policy, proof or operating fact so AI has a workspace source of truth.",
      done: verifiedKnowledge > 0,
      optional: false,
      href: "/knowledge",
      action: verifiedKnowledge > 0 ? "Review knowledge" : "Add knowledge",
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
