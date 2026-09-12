export type AppRole = "admin" | "marketing_manager" | "sales" | "viewer";

export type AppCapability =
  | "marketing.manage"
  | "integrations.manage"
  | "approvals.decide"
  | "leads.manage"
  | "security.view"
  | "operations.manage";

const roleCapabilities: Record<AppRole, ReadonlySet<AppCapability>> = {
  admin: new Set([
    "marketing.manage",
    "integrations.manage",
    "approvals.decide",
    "leads.manage",
    "security.view",
    "operations.manage",
  ]),
  marketing_manager: new Set([
    "marketing.manage",
    "integrations.manage",
    "approvals.decide",
    "leads.manage",
    "operations.manage",
  ]),
  sales: new Set(["leads.manage"]),
  viewer: new Set(),
};

export function roleCan(role: AppRole, capability: AppCapability) {
  return roleCapabilities[role].has(capability);
}

export function canViewSecurity(role: AppRole, platformAdmin = false) {
  return platformAdmin || roleCan(role, "security.view");
}

export function canAccessAgency(platformAdmin = false) {
  return platformAdmin;
}
