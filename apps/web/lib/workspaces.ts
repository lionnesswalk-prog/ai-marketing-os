import type { AppRole, AppSession } from "./auth";
import { setSession } from "./auth";
import { getPrisma } from "./prisma";

export type WorkspaceOption = {
  id: string;
  name: string;
  brandName?: string;
  role: AppRole;
  current: boolean;
};

function isDatabaseMode() {
  return process.env.AUTH_MODE === "database" && process.env.DATA_BACKEND === "postgres";
}

function role(value: string): AppRole {
  if (value === "admin" || value === "marketing_manager" || value === "sales" || value === "viewer") return value;
  return "viewer";
}

export async function listAccessibleWorkspaces(session: AppSession): Promise<WorkspaceOption[]> {
  if (!isDatabaseMode()) {
    return [{
      id: session.workspaceId,
      name: process.env.DEFAULT_WORKSPACE_NAME || "AI Marketing OS",
      brandName: process.env.DEFAULT_BRAND_NAME || "Lioness Walk",
      role: session.role,
      current: true,
    }];
  }

  const prisma = getPrisma();
  const accesses = await prisma.workspaceAccess.findMany({
    where: { userId: session.userId },
    include: {
      workspace: {
        include: {
          brands: { orderBy: { createdAt: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = accesses.map((access) => ({
    id: access.workspaceId,
    name: access.workspace.name,
    brandName: access.workspace.brands[0]?.name,
    role: role(access.role),
    current: access.workspaceId === session.workspaceId,
  }));

  if (!result.some((item) => item.id === session.workspaceId)) {
    const current = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      include: { brands: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (current) {
      result.unshift({
        id: current.id,
        name: current.name,
        brandName: current.brands[0]?.name,
        role: session.role,
        current: true,
      });
    }
  }

  return result;
}

export async function createClientWorkspace(
  session: AppSession,
  input: { workspaceName: string; brandName: string },
): Promise<WorkspaceOption> {
  if (!isDatabaseMode()) throw new Error("DATABASE_MODE_REQUIRED");
  if (!session.platformAdmin) throw new Error("WORKSPACE_CREATE_FORBIDDEN");

  const workspaceName = input.workspaceName.trim();
  const brandName = input.brandName.trim();
  if (workspaceName.length < 2 || brandName.length < 2) throw new Error("WORKSPACE_INPUT_INVALID");

  const prisma = getPrisma();
  const created = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        brands: {
          create: {
            name: brandName,
            voiceJson: {
              personality: ["intentional", "clear", "brand-specific"],
              avoid: ["unsupported claims", "fake urgency"],
            },
          },
        },
      },
      include: { brands: { take: 1 } },
    });

    await tx.workspaceAccess.create({
      data: {
        userId: session.userId,
        workspaceId: workspace.id,
        role: "admin",
      },
    });

    const brand = workspace.brands[0];
    if (brand) {
      await tx.auditLog.create({
        data: {
          brandId: brand.id,
          actorType: "platform_admin",
          actorId: session.userId,
          action: "client_workspace_created",
          entityType: "Workspace",
          entityId: workspace.id,
          payload: {
            workspaceName: workspace.name,
            brandName: brand.name,
          },
        },
      });
    }

    return workspace;
  });

  return {
    id: created.id,
    name: created.name,
    brandName: created.brands[0]?.name,
    role: "admin",
    current: false,
  };
}

export async function switchWorkspace(session: AppSession, workspaceId: string): Promise<AppSession> {
  if (!isDatabaseMode()) {
    if (workspaceId !== session.workspaceId) throw new Error("WORKSPACE_ACCESS_DENIED");
    return session;
  }

  const prisma = getPrisma();
  const access = await prisma.workspaceAccess.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId } },
    include: { workspace: true },
  });
  if (!access) throw new Error("WORKSPACE_ACCESS_DENIED");

  const next: AppSession = {
    ...session,
    workspaceId: access.workspaceId,
    role: role(access.role),
  };
  await setSession(next);
  return next;
}
