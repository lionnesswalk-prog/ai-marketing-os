import { requireSession } from "../../lib/auth";
import { dashboardData } from "../../lib/repository";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { getWorkspaceReadiness } from "../../lib/workspace-readiness";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Dashboard() {
  const session = await requireSession();
  const [data, profile, setup] = await Promise.all([dashboardData(), getCurrentBrandProfile(session), getWorkspaceReadiness(session)]);
  const metrics = [
    ["Tracked spend", money.format(data.spend)],
    ["Tracked revenue", money.format(data.revenue)],
    ["ROAS", `${data.roas.toFixed(2)}x`],
    ["Open leads", String(data.leads)],
    ["Pending approvals", String(data.pendingApprovals)],
    ["Campaigns needing action", String(data.campaignsNeedingAction)],
  ];

  return (
    <div>
      <div className="page-head dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">COMMAND CENTER</p>
          <h1>Marketing overview</h1>
          <p className="muted large">Paid media, social content, leads and approval-gated AI recommendations in one operating view.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{profile.name}</span>
          <span className="pill">{process.env.DATA_BACKEND === "postgres" ? "Production data" : "Preview data"}</span>
        </div>
      </div>

      <div className="workspace-setup card">
        <div className="workspace-setup-head">
          <div>
            <p className="eyebrow">WORKSPACE SETUP</p>
            <h2>{setup.progress === 100 ? "Core setup complete" : "Finish the core setup"}</h2>
            <p className="muted">
              {setup.progress === 100
                ? "Brand context, social connection and content workflow are ready."
                : `${setup.completedRequired} of ${setup.totalRequired} required steps complete. Optional steps can be added as the workspace grows.`}
            </p>
          </div>
          <div className="workspace-progress-value">{setup.progress}%</div>
        </div>

        <div className="workspace-progress-track" aria-label={`Workspace setup ${setup.progress}% complete`}>
          <span style={{ width: `${setup.progress}%` }} />
        </div>

        <div className="workspace-setup-list">
          {setup.steps.map((step, index) => (
            <div className={"workspace-setup-step " + (step.done ? "done" : "")} key={step.key}>
              <div className="workspace-step-index">{step.done ? "✓" : String(index + 1).padStart(2, "0")}</div>
              <div className="workspace-step-copy">
                <div className="workspace-step-title">
                  <strong>{step.title}</strong>
                  {step.optional && <span className="pill">Optional</span>}
                  {!step.optional && !step.done && <span className="health watch">Required</span>}
                </div>
                <p>{step.detail}</p>
              </div>
              <a className="text-link" href={step.href}>{step.action} →</a>
            </div>
          ))}
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map(([key, value], index) => (
          <div className="card metric-card" key={key}>
            <div className="metric-kicker">
              <div className="muted">{key}</div>
              <span className="metric-orb" />
            </div>
            <div className="metric">{value}</div>
            <div className="metric-index">Metric {String(index + 1).padStart(2, "0")}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">AI SIGNALS</p><h2>What needs attention</h2></div>
          <a className="text-link" href="/campaigns">Open campaigns →</a>
        </div>
        <div className="stack">
          {data.insights.map((insight) => (
            <article className="card insight" key={insight.id}>
              <div>
                <span className={`severity ${insight.severity}`}>{insight.severity}</span>
                <h3>{insight.title}</h3>
                <p className="muted large">{insight.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
