import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";
import { canEncryptIntegrations } from "./integration-crypto";

export type AuditEventView = {
  id: string;
  action: string;
  label: string;
  detail: string;
  severity: "info" | "watch" | "action";
  actor?: string;
  actorType: string;
  workspaceName: string;
  brandName: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
};

export type SecurityOverview = {
  scopeLabel: string;
  workspaces: number;
  members: number;
  pendingInvites: number;
  connectedIntegrations: number;
  failedPosts: number;
  posture: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
  events: AuditEventView[];
};

function databaseReady() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function eventLabel(action: string) {
  const labels: Record<string, string> = {
    client_workspace_created: "Client workspace created",
    enter_workspace: "Platform admin entered workspace",
    workspace_invite_created: "Workspace invite created",
    workspace_invite_revoked: "Workspace invite revoked",
    workspace_invite_accepted: "Workspace invite accepted",
    invite_account_created: "Invited account created",
    member_role_updated: "Member role changed",
    member_access_revoked: "Member access revoked",
    brand_profile_updated: "Brand profile updated",
    campaign_draft_created: "Campaign draft created",
    billing_checkout_started: "Billing checkout started",
    billing_portal_opened: "Billing portal opened",
    billing_subscription_synced: "Subscription status updated",
  };
  return labels[action] || action.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function eventSeverity(action: string): AuditEventView["severity"] {
  if (["member_access_revoked", "workspace_invite_revoked"].includes(action)) return "action";
  if (["member_role_updated", "enter_workspace"].includes(action)) return "watch";
  return "info";
}

function eventDetail(action: string, rawPayload: unknown) {
  const payload = payloadObject(rawPayload);
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const role = typeof payload.role === "string" ? payload.role.replaceAll("_", " ") : undefined;
  const previousRole = typeof payload.previousRole === "string" ? payload.previousRole.replaceAll("_", " ") : undefined;
  const nextRole = typeof payload.nextRole === "string" ? payload.nextRole.replaceAll("_", " ") : undefined;
  const workspaceName = typeof payload.workspaceName === "string" ? payload.workspaceName : undefined;
  const brandName = typeof payload.brandName === "string" ? payload.brandName : undefined;

  if (action === "client_workspace_created") return [workspaceName, brandName].filter(Boolean).join(" · ") || "New isolated workspace";
  if (action === "workspace_invite_created") return [email, role && "Role: " + role].filter(Boolean).join(" · ") || "Invitation created";
  if (action === "workspace_invite_revoked") return email ? "Invite revoked for " + email : "Invitation revoked";
  if (action === "workspace_invite_accepted") return email ? email + " joined the workspace" : "Invitation accepted";
  if (action === "invite_account_created") return email ? "New account created for " + email : "Invited account created";
  if (action === "member_role_updated") return [email, previousRole && nextRole ? previousRole + " → " + nextRole : undefined].filter(Boolean).join(" · ") || "Workspace role changed";
  if (action === "member_access_revoked") return email ? "Access revoked for " + email : "Workspace access revoked";
  if (action === "enter_workspace") return workspaceName ? "Entered " + workspaceName + " from agency control" : "Agency workspace opened";
  if (action === "brand_profile_updated") return brandName ? brandName + " AI context updated" : "Brand AI context updated";
  if (action === "campaign_draft_created") return typeof payload.name === "string" ? payload.name + " saved as an internal draft" : "Internal campaign draft saved";
  if (action === "billing_checkout_started") {
    const planKey = typeof payload.planKey === "string" ? payload.planKey : "selected";
    return "Stripe Checkout started for " + planKey + " plan";
  }
  if (action === "billing_portal_opened") return "Stripe Customer Portal opened";
  if (action === "billing_subscription_synced") {
    const planKey = typeof payload.planKey === "string" ? payload.planKey : undefined;
    const status = typeof payload.status === "string" ? payload.status : undefined;
    return [planKey, status].filter(Boolean).join(" · ") || "Stripe subscription synchronized";
  }
  return "Security-relevant workspace activity";
}

export async function getBillingAuditEvents(session: AppSession, take = 20): Promise<AuditEventView[]> {
  if (!databaseReady()) return [];
  const prisma = getPrisma();
  const rows = await prisma.auditLog.findMany({
    where: {
      brand: { workspaceId: session.workspaceId },
      action: { startsWith: "billing_" },
    },
    include: {
      brand: {
        include: {
          workspace: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const actorIds = Array.from(new Set(rows.map((row) => row.actorId).filter((value): value is string => Boolean(value))));
  const actors = actorIds.length
    ? await prisma.workspaceUser.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    label: eventLabel(row.action),
    detail: eventDetail(row.action, row.payload),
    severity: eventSeverity(row.action),
    actor: row.actorId ? actorMap.get(row.actorId) : undefined,
    actorType: row.actorType,
    workspaceName: row.brand.workspace.name,
    brandName: row.brand.name,
    entityType: row.entityType,
    entityId: row.entityId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function recordAuditEvent(input: {
  workspaceId: string;
  actorType: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}) {
  if (!databaseReady()) return;
  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) return;

  await prisma.auditLog.create({
    data: {
      brandId: brand.id,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload as any,
    },
  });
}

export async function getSecurityOverview(session: AppSession): Promise<SecurityOverview> {
  const platformAdmin = Boolean(session.platformAdmin);
  if (!platformAdmin && session.role !== "admin") throw new Error("SECURITY_ACCESS_DENIED");

  if (!databaseReady()) {
    return {
      scopeLabel: platformAdmin ? "Agency-wide" : "Current workspace",
      workspaces: 1,
      members: 1,
      pendingInvites: 0,
      connectedIntegrations: 0,
      failedPosts: 0,
      posture: [
        { key: "database", label: "Database auth", ready: false, detail: "Preview mode is active." },
        { key: "encryption", label: "Token encryption", ready: canEncryptIntegrations(), detail: "Integration secrets require encrypted storage." },
        { key: "tenant", label: "Tenant isolation", ready: process.env.ALLOW_SHARED_ENV_INTEGRATIONS !== "true", detail: "Shared environment integrations must stay disabled." },
      ],
      events: [],
    };
  }

  const prisma = getPrisma();
  const workspaceWhere = platformAdmin ? {} : { id: session.workspaceId };
  const accessWhere = platformAdmin ? {} : { workspaceId: session.workspaceId };
  const inviteWhere = platformAdmin
    ? { acceptedAt: null as Date | null, revokedAt: null as Date | null, expiresAt: { gt: new Date() } }
    : { workspaceId: session.workspaceId, acceptedAt: null as Date | null, revokedAt: null as Date | null, expiresAt: { gt: new Date() } };
  const brandRelationWhere = platformAdmin ? {} : { brand: { workspaceId: session.workspaceId } };

  const [workspaces, members, pendingInvites, connectedIntegrations, failedPosts, rows] = await Promise.all([
    prisma.workspace.count({ where: workspaceWhere }),
    prisma.workspaceAccess.count({ where: accessWhere }),
    prisma.workspaceInvite.count({ where: inviteWhere }),
    prisma.integrationConnection.count({
      where: { ...brandRelationWhere, status: "connected" },
    }),
    prisma.socialPost.count({
      where: { ...brandRelationWhere, status: "failed" },
    }),
    prisma.auditLog.findMany({
      where: platformAdmin ? {} : { brand: { workspaceId: session.workspaceId } },
      include: {
        brand: {
          include: {
            workspace: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const actorIds = Array.from(new Set(rows.map((row) => row.actorId).filter((value): value is string => Boolean(value))));
  const actors = actorIds.length
    ? await prisma.workspaceUser.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor.name || actor.email]));

  return {
    scopeLabel: platformAdmin ? "Agency-wide" : "Current workspace",
    workspaces,
    members,
    pendingInvites,
    connectedIntegrations,
    failedPosts,
    posture: [
      {
        key: "database",
        label: "Database authentication",
        ready: process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres",
        detail: "Every request is checked against current workspace membership.",
      },
      {
        key: "encryption",
        label: "Integration token encryption",
        ready: canEncryptIntegrations(),
        detail: "OAuth access and refresh tokens are encrypted before database storage.",
      },
      {
        key: "tenant",
        label: "Cross-client token isolation",
        ready: process.env.ALLOW_SHARED_ENV_INTEGRATIONS !== "true",
        detail: "Shared provider tokens are disabled in multi-client production.",
      },
      {
        key: "platform-admin",
        label: "Platform-admin verification",
        ready: true,
        detail: "Platform-admin status is refreshed from the database on authenticated requests.",
      },
    ],
    events: rows.map((row) => ({
      id: row.id,
      action: row.action,
      label: eventLabel(row.action),
      detail: eventDetail(row.action, row.payload),
      severity: eventSeverity(row.action),
      actor: row.actorId ? actorMap.get(row.actorId) : undefined,
      actorType: row.actorType,
      workspaceName: row.brand.workspace.name,
      brandName: row.brand.name,
      entityType: row.entityType,
      entityId: row.entityId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
