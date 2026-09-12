import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { getSecurityOverview } from "../../lib/audit";
import { canViewSecurity } from "../../lib/access-policy";

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SecurityPage() {
  const session = await requireSession();
  if (!canViewSecurity(session.role, Boolean(session.platformAdmin))) redirect("/dashboard");

  const overview = await getSecurityOverview(session);

  return (
    <div className="security-page">
      <div className="dashboard-hero security-hero">
        <div className="hero-copy">
          <p className="eyebrow">SECURITY & GOVERNANCE</p>
          <h1>Access and audit center</h1>
          <p className="muted large">
            Review tenant isolation, privileged access, pending invitations and security-relevant activity across {overview.scopeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{overview.scopeLabel}</span>
          <span className="pill">DB-backed access checks</span>
        </div>
      </div>

      <div className="security-metrics">
        <article className="card"><span>Workspaces</span><strong>{overview.workspaces}</strong></article>
        <article className="card"><span>Member access</span><strong>{overview.members}</strong></article>
        <article className="card"><span>Pending invites</span><strong>{overview.pendingInvites}</strong></article>
        <article className="card"><span>Connected accounts</span><strong>{overview.connectedIntegrations}</strong></article>
        <article className="card"><span>Failed posts</span><strong>{overview.failedPosts}</strong></article>
      </div>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">SECURITY POSTURE</p><h2>Production safeguards</h2></div>
          <span className="pill">{overview.posture.filter((item) => item.ready).length}/{overview.posture.length} healthy</span>
        </div>
        <div className="security-posture-grid">
          {overview.posture.map((item) => (
            <article className="card security-posture-card" key={item.key}>
              <div className="security-posture-head">
                <span className={"security-light " + (item.ready ? "ready" : "missing")} />
                <strong>{item.label}</strong>
                <span className={"health " + (item.ready ? "healthy" : "needs_action")}>{item.ready ? "Healthy" : "Needs action"}</span>
              </div>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent privileged activity</h2></div>
          <span className="pill">{overview.events.length} events</span>
        </div>

        {overview.events.length ? (
          <div className="security-audit-list">
            {overview.events.map((event) => (
              <article className="card security-event" key={event.id}>
                <div className="security-event-main">
                  <span className={"severity " + event.severity}>{event.severity}</span>
                  <div>
                    <h3>{event.label}</h3>
                    <p>{event.detail}</p>
                    <div className="security-event-meta">
                      <span>{event.workspaceName}</span>
                      <span>{event.brandName}</span>
                      <span>{event.actor || event.actorType.replaceAll("_", " ")}</span>
                    </div>
                  </div>
                </div>
                <div className="security-event-time">
                  <strong>{dateTime(event.createdAt)}</strong>
                  <span>{event.entityType}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card empty">
            <h3>No audit events yet</h3>
            <p className="muted">New client creation, workspace entry, invitations, role changes and access revocations will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
