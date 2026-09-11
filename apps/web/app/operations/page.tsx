import { redirect } from "next/navigation";
import { canManageMarketing, requireSession } from "../../lib/auth";
import { getOperationsOverview } from "../../lib/operations";
import { OperationsRunButton } from "../../components/OperationsRunButton";
import { ProviderDiagnosticsButton } from "../../components/ProviderDiagnosticsButton";

function displayTime(value?: string) {
  return value ? new Date(value).toLocaleString("en-IN") : "None";
}

export default async function OperationsPage() {
  const session = await requireSession();
  if (!canManageMarketing(session.role)) redirect("/dashboard");

  const data = await getOperationsOverview(session);
  const healthClass = data.queueHealth.state === "healthy"
    ? "healthy"
    : data.queueHealth.state === "watch"
      ? "watch"
      : "needs_action";

  return (
    <div className="operations-page">
      <div className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">WORKSPACE OPERATIONS</p>
          <h1>Publishing reliability & delivery health.</h1>
          <p className="muted large">
            See queue pressure, overdue work, provider readiness and delivery failures without opening each social network.
          </p>
        </div>
        <div className="hero-badges">
          <span className={"health " + healthClass}>{data.queueHealth.label}</span>
          <span className={data.scheduler.authenticated ? "pill accent" : "pill"}>
            {data.scheduler.authenticated ? "Scheduler auth ready" : "Scheduler secret missing"}
          </span>
        </div>
      </div>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">QUEUE HEALTH</p>
            <h2>Delivery control</h2>
          </div>
          <OperationsRunButton disabled={!data.scheduler.manualRunAvailable} />
        </div>

        <div className="card">
          <div className="meta-row">
            <span className={"health " + healthClass}>{data.queueHealth.label}</span>
            <span className="pill">{data.scheduler.cadence}</span>
          </div>
          <p className="muted large">{data.queueHealth.detail}</p>
        </div>

        <div className="metric-grid">
          <article className="card metric-card"><span className="eyebrow">SCHEDULED</span><div className="metric">{data.counts.scheduled}</div><div className="metric-index">Queue total</div></article>
          <article className="card metric-card"><span className="eyebrow">OVERDUE</span><div className="metric">{data.counts.overdueScheduled}</div><div className="metric-index">Due but not claimed</div></article>
          <article className="card metric-card"><span className="eyebrow">PUBLISHING</span><div className="metric">{data.counts.publishing}</div><div className="metric-index">Provider / worker active</div></article>
          <article className="card metric-card"><span className="eyebrow">FAILED</span><div className="metric">{data.counts.failed}</div><div className="metric-index">{data.counts.failedLast24h} in last 24h</div></article>
          <article className="card metric-card"><span className="eyebrow">STALE CLAIMS</span><div className="metric">{data.counts.stalePublishing}</div><div className="metric-index">Manual review protection</div></article>
          <article className="card metric-card"><span className="eyebrow">PUBLISHED</span><div className="metric">{data.counts.published}</div><div className="metric-index">Recorded successes</div></article>
        </div>

        <div className="two-col">
          <article className="card">
            <p className="eyebrow">NEXT SCHEDULE</p>
            <h3>{displayTime(data.nextScheduledAt)}</h3>
            <p className="muted">Earliest future scheduled post in this workspace.</p>
          </article>
          <article className="card">
            <p className="eyebrow">OLDEST OVERDUE</p>
            <h3>{displayTime(data.oldestOverdueAt)}</h3>
            <p className="muted">Oldest item that should already have been claimed by the scheduler.</p>
          </article>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">PROVIDER HEALTH</p><h2>Workspace connections</h2></div>
          <span className="pill">{data.providers.filter((provider) => provider.connected).length}/{data.providers.length} connected</span>
        </div>
        <div className="metric-grid">
          {data.providers.map((provider) => (
            <article className="card" key={provider.id}>
              <div className="row-between">
                <strong>{provider.name}</strong>
                <span className={"health " + (provider.connectionCheckFailed ? "needs_action" : provider.connected ? "healthy" : provider.setupReady ? "watch" : "needs_action")}>
                  {provider.connectionCheckFailed ? "Health check failed" : provider.connected ? "Connected" : provider.setupReady ? "Ready to connect" : "Platform setup"}
                </span>
              </div>
              <p className="muted">{provider.connectionCheckFailed ? "Portal could not read the saved connection state. Review integration storage and runtime logs." : provider.accountLabel || (provider.setupReady ? "No client account connected yet." : "Central provider app is not ready yet.")}</p>
            </article>
          ))}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row-between">
            <div>
              <p className="eyebrow">LIVE API DIAGNOSTICS</p>
              <h3>Verify saved provider access without publishing</h3>
              <p className="muted">Runs read-only checks against connected social APIs. It does not create, edit, or delete posts.</p>
            </div>
            <ProviderDiagnosticsButton />
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">DELIVERY ISSUES</p><h2>Recent failed or processing posts</h2></div>
          <a className="text-link" href="/social">Open Social Hub →</a>
        </div>
        {data.recentIssues.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Platform</th><th>Post</th><th>Status</th><th>Last attempt</th><th>Delivery detail</th></tr></thead>
              <tbody>
                {data.recentIssues.map((issue) => (
                  <tr key={issue.id}>
                    <td><span className="pill">{issue.platform}</span></td>
                    <td><strong>{issue.title}</strong><div className="muted">{issue.scheduledAt ? "Scheduled " + displayTime(issue.scheduledAt) : "No schedule"}</div></td>
                    <td><span className={"health " + (issue.status === "failed" ? "needs_action" : "watch")}>{issue.status}</span></td>
                    <td>{displayTime(issue.lastDeliveryAttemptAt || issue.updatedAt)}</td>
                    <td>{issue.error || (issue.externalId ? "Provider accepted the post and processing is still pending." : "Worker claim is awaiting confirmation.")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty"><h3>No delivery issues</h3><p className="muted">Failed and long-running publishing work will appear here.</p></div>
        )}
      </section>
    </div>
  );
}
