export function requireWorkspaceId(workspaceId: string) {
  const value = workspaceId.trim();
  if (!value) throw new Error("WORKSPACE_SCOPE_REQUIRED");
  return value;
}

export function brandIsWorkspaceScope(workspaceId: string) {
  const id = requireWorkspaceId(workspaceId);
  return { brand: { is: { workspaceId: id } } } as const;
}

export function brandWorkspaceScope(workspaceId: string) {
  const id = requireWorkspaceId(workspaceId);
  return { brand: { workspaceId: id } } as const;
}

export function assertWorkspaceResource(sessionWorkspaceId: string, resourceWorkspaceId: string) {
  const sessionId = requireWorkspaceId(sessionWorkspaceId);
  const resourceId = requireWorkspaceId(resourceWorkspaceId);
  if (sessionId !== resourceId) throw new Error("WORKSPACE_SCOPE_MISMATCH");
}
