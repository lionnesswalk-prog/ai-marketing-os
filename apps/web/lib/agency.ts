import type { AppSession } from "./auth";
import { setSession } from "./auth";
import { getPrisma } from "./prisma";

export type AgencyClientView = {
  workspaceId: string;
  workspaceName: string;
  brandId?: string;
  brandName?: string;
  members: number;
  connectedProviders: string[];
  scheduledPosts: number;
  failedPosts: number;
  leads: number;
  campaigns: number;
  lastActivityAt?: string;
  billingPlan?: "starter" | "growth" | "scale";
  billingStatus?: string;
  billingPeriodEnd?: string;
  billingCancelAtPeriodEnd?: boolean;
  current: boolean;
};

function ready() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function requirePlatformAdmin(session: AppSession) {
  if (!ready()) throw new Error("DATABASE_MODE_REQUIRED");
  if (!session.platformAdmin) throw new Error("PLATFORM_ADMIN_REQUIRED");
}

export async function listAgencyClients(session: AppSession): Promise<AgencyClientView[]> {
  requirePlatformAdmin(session);
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    include: {
      brands: { orderBy: { createdAt: "asc" }, take: 1 },
      subscription: true,
      _count: { select: { accesses: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(workspaces.map(async (workspace) => {
    const brand = workspace.brands[0];
    if (!brand) {
      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        members: workspace._count.accesses,
        connectedProviders: [],
        scheduledPosts: 0,
        failedPosts: 0,
        leads: 0,
        campaigns: 0,
        billingPlan: workspace.subscription?.planKey === "growth" || workspace.subscription?.planKey === "scale" ? workspace.subscription.planKey : workspace.subscription ? "starter" : undefined,
        billingStatus: workspace.subscription?.status,
        billingPeriodEnd: workspace.subscription?.currentPeriodEnd?.toISOString(),
        billingCancelAtPeriodEnd: workspace.subscription?.cancelAtPeriodEnd,
        current: workspace.id === session.workspaceId,
      };
    }

    const [integrations, scheduledPosts, failedPosts, leads, campaigns, latestPost] = await Promise.all([
      prisma.integrationConnection.findMany({
        where: { brandId: brand.id, status: "connected" },
        select: { provider: true },
      }),
      prisma.socialPost.count({ where: { brandId: brand.id, status: "scheduled" } }),
      prisma.socialPost.count({ where: { brandId: brand.id, status: "failed" } }),
      prisma.lead.count({ where: { brandId: brand.id } }),
      prisma.campaign.count({ where: { brandId: brand.id } }),
      prisma.socialPost.findFirst({
        where: { brandId: brand.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      brandId: brand.id,
      brandName: brand.name,
      members: workspace._count.accesses,
      connectedProviders: integrations.map((item) => item.provider),
      scheduledPosts,
      failedPosts,
      leads,
      campaigns,
      lastActivityAt: latestPost?.updatedAt.toISOString(),
      billingPlan: workspace.subscription?.planKey === "growth" || workspace.subscription?.planKey === "scale" ? workspace.subscription.planKey : workspace.subscription ? "starter" : undefined,
      billingStatus: workspace.subscription?.status,
      billingPeriodEnd: workspace.subscription?.currentPeriodEnd?.toISOString(),
      billingCancelAtPeriodEnd: workspace.subscription?.cancelAtPeriodEnd,
      current: workspace.id === session.workspaceId,
    };
  }));
}

export async function enterAgencyWorkspace(session: AppSession, workspaceId: string) {
  requirePlatformAdmin(session);
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { brands: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");

  await prisma.workspaceAccess.upsert({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId,
      },
    },
    create: {
      userId: session.userId,
      workspaceId,
      role: "admin",
    },
    update: { role: "admin" },
  });

  const brand = workspace.brands[0];
  if (brand) {
    await prisma.auditLog.create({
      data: {
        brandId: brand.id,
        actorType: "platform_admin",
        actorId: session.userId,
        action: "enter_workspace",
        entityType: "Workspace",
        entityId: workspace.id,
        payload: {
          workspaceName: workspace.name,
          source: "agency_clients",
        },
      },
    });
  }

  const next: AppSession = {
    ...session,
    workspaceId,
    role: "admin",
  };
  await setSession(next);
  return next;
}
