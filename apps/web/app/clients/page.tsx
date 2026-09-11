import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { enterAgencyWorkspace, listAgencyClients } from "../../lib/agency";
import { ClientOnboardingForm } from "../../components/ClientOnboardingForm";

async function openClientAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  await enterAgencyWorkspace(session, workspaceId);
  redirect("/dashboard");
}

export default async function ClientsPage() {
  const session = await requireSession();
  if (!session.platformAdmin) redirect("/dashboard");

  const clients = await listAgencyClients(session);

  return (
    <div className="clients-page">
      <div className="dashboard-hero clients-hero">
        <div className="hero-copy">
          <p className="eyebrow">AGENCY WORKSPACES</p>
          <h1>Clients</h1>
          <p className="muted large">
            Each client gets an isolated brand workspace with its own social connections, content, analytics, leads and campaigns.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{clients.length} workspaces</span>
          <span className="pill">Tenant isolated</span>
        </div>
      </div>

      <div className="clients-layout">
        <ClientOnboardingForm />

        <section>
          <div className="section-head client-list-head">
            <div>
              <p className="eyebrow">AGENCY OVERVIEW</p>
              <h2>All client workspaces</h2>
            </div>
          </div>

          <div className="client-grid agency-client-grid">
            {clients.map((client) => (
              <article
                className={`card client-card agency-client-card ${client.current ? "current" : ""}`}
                key={client.workspaceId}
              >
                <div className="client-card-head">
                  <div>
                    <span className="client-brand-label">{client.brandName || "Brand"}</span>
                    <h3>{client.workspaceName}</h3>
                  </div>
                  <span className={client.current ? "pill accent" : "pill"}>
                    {client.current ? "Active" : `${client.members} members`}
                  </span>
                </div>

                <div className="agency-client-stats">
                  <div><span>Connected</span><strong>{client.connectedProviders.length}</strong></div>
                  <div><span>Scheduled</span><strong>{client.scheduledPosts}</strong></div>
                  <div><span>Failed</span><strong>{client.failedPosts}</strong></div>
                  <div><span>Leads</span><strong>{client.leads}</strong></div>
                  <div><span>Campaigns</span><strong>{client.campaigns}</strong></div>
                </div>

                <div className="agency-provider-row">
                  {client.connectedProviders.length ? (
                    client.connectedProviders.map((provider) => (
                      <span className="pill" key={provider}>{provider}</span>
                    ))
                  ) : (
                    <span className="muted">No social accounts connected yet.</span>
                  )}
                </div>

                <div className="agency-client-footer">
                  <small>
                    {client.lastActivityAt
                      ? `Last social activity · ${new Date(client.lastActivityAt).toLocaleString("en-IN")}`
                      : "No social activity yet"}
                  </small>
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
