import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { enterAgencyWorkspace, listAgencyClients } from "../../lib/agency";
import { ClientOnboardingForm } from "../../components/ClientOnboardingForm";
import { getAgencyBillingOverview } from "../../lib/billing";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function billingTone(status?: string) {
  if (status === "active" || status === "trialing") return "health healthy";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "health needs_action";
  return "pill";
}

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

  const [clients, billing] = await Promise.all([
    listAgencyClients(session),
    getAgencyBillingOverview(session),
  ]);

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

      <section>
        <div className="section-head">
          <div><p className="eyebrow">AGENCY BILLING</p><h2>Subscription portfolio</h2></div>
          <span className="pill">{billing.subscribedWorkspaces}/{billing.totalWorkspaces} subscribed</span>
        </div>
        <div className="security-metrics">
          <article className="card"><span>Active</span><strong>{billing.active + billing.trialing}</strong></article>
          <article className="card"><span>Past due / unpaid</span><strong>{billing.pastDue}</strong></article>
          <article className="card"><span>No subscription</span><strong>{billing.noSubscription}</strong></article>
          <article className="card"><span>Configured MRR</span><strong>{billing.mrrInr === undefined ? "—" : money.format(billing.mrrInr)}</strong></article>
          <article className="card"><span>Plan mix</span><strong>{billing.byPlan.starter}/{billing.byPlan.growth}/{billing.byPlan.scale}</strong><small>Starter · Growth · Scale</small></article>
        </div>
        {!billing.revenueConfigured && billing.active + billing.trialing > 0 && (
          <div className="profile-notice">
            MRR stays hidden until monthly INR amounts are configured for every active/trialing plan. No revenue is estimated from display-price text.
          </div>
        )}
      </section>

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
                  <div className="meta-row">
                    <span className={billingTone(client.billingStatus)}>
                      {client.billingStatus || "Not subscribed"}
                    </span>
                    <span className={client.current ? "pill accent" : "pill"}>
                      {client.current ? "Open now" : `${client.members} members`}
                    </span>
                  </div>
                </div>

                <div className="agency-client-stats">
                  <div><span>Connected</span><strong>{client.connectedProviders.length}</strong></div>
                  <div><span>Scheduled</span><strong>{client.scheduledPosts}</strong></div>
                  <div><span>Failed</span><strong>{client.failedPosts}</strong></div>
                  <div><span>Leads</span><strong>{client.leads}</strong></div>
                  <div><span>Campaigns</span><strong>{client.campaigns}</strong></div>
                  <div><span>Plan</span><strong>{client.billingPlan ? client.billingPlan.charAt(0).toUpperCase() + client.billingPlan.slice(1) : "—"}</strong></div>
                  <div><span>Renewal</span><strong>{client.billingPeriodEnd ? new Date(client.billingPeriodEnd).toLocaleDateString("en-IN") : "—"}</strong></div>
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
