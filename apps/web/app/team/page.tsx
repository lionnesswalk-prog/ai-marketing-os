import { requireSession } from "../../lib/auth";
import { listWorkspaceMembers } from "../../lib/workspace-members";
import { TeamManager } from "../../components/TeamManager";

export default async function TeamPage() {
  const session = await requireSession();
  const data = await listWorkspaceMembers(session);

  return (
    <div className="team-page">
      <div className="dashboard-hero team-hero">
        <div className="hero-copy">
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>Team & client access</h1>
          <p className="muted large">Invite clients and teammates into only the active workspace, assign least-privilege roles, and revoke access without affecting other client workspaces.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{data.members.length} members</span>
          <span className="pill">{session.role.replace("_", " ")}</span>
        </div>
      </div>

      <div className="team-role-guide card">
        <div><strong>Admin</strong><span>Full workspace and access management</span></div>
        <div><strong>Marketing Manager</strong><span>Campaign, content and approvals</span></div>
        <div><strong>Sales</strong><span>Lead and inquiry workflows</span></div>
        <div><strong>Viewer</strong><span>Read-only workspace visibility</span></div>
      </div>

      <TeamManager
        members={data.members}
        invites={data.invites}
        canManage={session.role === "admin"}
      />
    </div>
  );
}
