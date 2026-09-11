import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { createClientWorkspace, switchWorkspace } from "../../lib/workspaces";
import { enterAgencyWorkspace, listAgencyClients } from "../../lib/agency";

function notice(status?: string) {
  if (status === "created") return { tone: "success", text: "Client workspace created and opened." };
  if (status === "invalid") return { tone: "error", text: "Enter a valid client and brand name." };
  if (status === "database") return { tone: "error", text: "Client workspaces require production database mode." };
  if (status === "forbidden") return { tone: "error", text: "Only platform administrators can create client workspaces." };
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
  await enterAgencyWorkspace(session, workspaceId);
  redirect("/dashboard");
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  if (!session.platformAdmin) redirect("/dashboard");
  const clients = await listAgencyClients(session);
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
          <span className="pill accent">{clients.length} workspaces</span>
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
            <button className="btn" type="submit" disabled={!session.platformAdmin}>Create client workspace</button>
          </form>
          {!session.platformAdmin && <p className="muted">Only platform administrators can add client workspaces.</p>}
        </section>

        <section>
          <div className="section-head client-list-head">
            <div><p className="eyebrow">AGENCY OVERVIEW</p><h2>All client workspaces</h2></div>
          </div>
          <div className="client-grid agency-client-grid">
            {clients.map((client) => (
              <article className={`card client-card agency-client-card ${client.current ? "current" : ""}`} key={client.workspaceId}>
                <div className="client-card-head">
                  <div>
                    <span className="client-brand-label">{client.brandName || "Brand"}</span>
                    <h3>{client.workspaceName}</h3>
                  </div>
                  <span className={client.current ? "pill accent" : "pill"}>{client.current ? "Active" : `${client.members} members`}</span>
                </div>

                <div className="agency-client-stats">
                  <div><span>Connected</span><strong>{client.connectedProviders.length}</strong></div>
                  <div><span>Scheduled</span><strong>{client.scheduledPosts}</strong></div>
                  <div><span>Failed</span><strong>{client.failedPosts}</strong></div>
                  <div><span>Leads</span><strong>{client.leads}</strong></div>
                  <div><span>Campaigns</span><strong>{client.campaigns}</strong></div>
                </div>

                <div className="agency-provider-row">
                  {client.connectedProviders.length ? client.connectedProviders.map((provider) => (
                    <span className="pill" key={provider}>{provider}</span>
                  )) : <span className="muted">No social accounts connected yet.</span>}
                </div>

                <div className="agency-client-footer">
                  <small>{client.lastActivityAt ? `Last social activity · ${new Date(client.lastActivityAt).toLocaleString("en-IN")}` : "No social activity yet"}</small>
                  {!client.current && (
                    <form action={openClientAction}>
                      <input type="hidden" name="workspaceId" value={client.workspaceId} />
                      <button className="btn secondary" type="submit">Open client</button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
