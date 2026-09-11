import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { listWorkspaceTeam } from "../../lib/workspace-invites";
import { ClientTeamManager } from "../../components/ClientTeamManager";
import {
  createClientWorkspace,
  listAccessibleWorkspaces,
  switchWorkspace,
} from "../../lib/workspaces";

function notice(status?: string) {
  if (status === "created") return { tone: "success", text: "Client workspace created and opened." };
  if (status === "invalid") return { tone: "error", text: "Enter a valid client and brand name." };
  if (status === "database") return { tone: "error", text: "Client workspaces require production database mode." };
  if (status === "forbidden") return { tone: "error", text: "Only workspace admins can create client workspaces." };
  if (status === "failed") return { tone: "error", text: "Unable to create the client workspace." };
  return null;
}

async function createClientAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const brandName = String(formData.get("brandName") ?? "").trim();

  if (workspaceName.length < 2 || brandName.length < 2) redirect("/clients?status=invalid");

  let createdId = "";
  try {
    const created = await createClientWorkspace(session, { workspaceName, brandName });
    createdId = created.id;
    await switchWorkspace(session, created.id);
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_MODE_REQUIRED") redirect("/clients?status=database");
    if (error instanceof Error && error.message === "WORKSPACE_CREATE_FORBIDDEN") redirect("/clients?status=forbidden");
    redirect("/clients?status=failed");
  }

  if (createdId) redirect("/dashboard");
  redirect("/clients?status=failed");
}

async function openClientAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  await switchWorkspace(session, workspaceId);
  redirect("/dashboard");
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const [workspaces, team] = await Promise.all([listAccessibleWorkspaces(session), listWorkspaceTeam(session)]);
  const params = searchParams ? await searchParams : undefined;
  const message = notice(params?.status);

  return (
    <div className="clients-page">
      <div className="dashboard-hero clients-hero">
        <div className="hero-copy">
          <p className="eyebrow">AGENCY WORKSPACES</p>
          <h1>Clients</h1>
          <p className="muted large">Each client gets an isolated brand workspace with its own social connections, content, analytics, leads and campaigns.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{workspaces.length} workspaces</span>
          <span className="pill">Tenant isolated</span>
        </div>
      </div>

      {message && <div className={`profile-notice ${message.tone}`}>{message.text}</div>}

      <div className="clients-layout">
        <section className="card client-create-card">
          <p className="eyebrow">ADD CLIENT</p>
          <h2>New workspace</h2>
          <p className="muted">Create a private workspace for a new client. You can connect their social accounts after switching into it.</p>
          <form action={createClientAction}>
            <label>Client / workspace name<input name="workspaceName" minLength={2} required placeholder="Acme Fashion" /></label>
            <label>Brand name<input name="brandName" minLength={2} required placeholder="Acme" /></label>
            <button className="btn" type="submit" disabled={session.role !== "admin"}>Create client workspace</button>
          </form>
          {session.role !== "admin" && <p className="muted">Only admins can add client workspaces.</p>}
        </section>

        <section>
          <div className="section-head client-list-head">
            <div><p className="eyebrow">YOUR CLIENTS</p><h2>Available workspaces</h2></div>
          </div>
          <div className="client-grid">
            {workspaces.map((workspace) => (
              <article className={`card client-card ${workspace.current ? "current" : ""}`} key={workspace.id}>
                <div className="client-card-head">
                  <div>
                    <span className="client-brand-label">{workspace.brandName || "Brand"}</span>
                    <h3>{workspace.name}</h3>
                  </div>
                  <span className={workspace.current ? "pill accent" : "pill"}>{workspace.current ? "Active" : workspace.role}</span>
                </div>
                <p className="muted">Social accounts, publishing, analytics and campaign data are isolated inside this workspace.</p>
                {!workspace.current && (
                  <form action={openClientAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button className="btn secondary" type="submit">Open client</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      <ClientTeamManager
        members={team.members}
        invites={team.invites}
        canManage={session.role === "admin"}
      />
    </div>
  );
}
