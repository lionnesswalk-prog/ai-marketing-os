import { requireSession } from "../../lib/auth";
import { dashboardData } from "../../lib/repository";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { getWorkspaceReadiness } from "../../lib/workspace-readiness";
import { getIndustryPlaybook } from "../../lib/industry-intelligence";
import { effectiveDataBackend } from "../../lib/runtime-mode";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Dashboard() {
  const session = await requireSession();
  const [data, profile, setup] = await Promise.all([dashboardData(), getCurrentBrandProfile(session), getWorkspaceReadiness(session)]);
  const industry = getIndustryPlaybook(profile.industry);
  const metrics = [
    { label: "Tracked spend", value: money.format(data.spend), href: "/campaigns" },
    { label: "Tracked revenue", value: money.format(data.revenue), href: "/analytics" },
    { label: "ROAS", value: `${data.roas.toFixed(2)}x`, href: "/analytics" },
    { label: "Open leads", value: String(data.leads), href: "/leads" },
    { label: "Pending approvals", value: String(data.pendingApprovals), href: "/approvals" },
    { label: "Campaigns needing action", value: String(data.campaignsNeedingAction), href: "/campaigns" },
  ];
  const productionData = effectiveDataBackend() === "postgres";

  return (
    <div>
      <div className="page-head dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">COMMAND CENTER</p>
          <h1>Marketing overview</h1>
          <p className="muted large">Paid media, social content, leads and approval-gated AI recommendations in one operating view.</p>
        </div>
        <div className="hero-badges">
          <a className="pill accent dashboard-badge-link" href="/brand" aria-label={`Open ${profile.name} Brand Profile`}>{profile.name}</a>
          <a className="pill dashboard-badge-link" href={productionData ? "/analytics" : "/platform"}>
            {productionData ? "Production data" : "Preview data"}
          </a>
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
        {metrics.map((metric, index) => (
          <a className="card metric-card metric-card-link" href={metric.href} key={metric.label}>
            <div className="metric-kicker">
              <div className="muted">{metric.label}</div>
              <span className="metric-orb" />
            </div>
            <div className="metric">{metric.value}</div>
            <div className="metric-index">Open · {String(index + 1).padStart(2, "0")}</div>
          </a>
        ))}
      </div>


      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">INDUSTRY INTELLIGENCE</p>
            <h2>{industry.label} operating view</h2>
          </div>
          <a className="text-link" href="/brand">Edit business context →</a>
        </div>
        <div className="metric-grid">
          <article className="card">
            <p className="eyebrow">FUNNEL</p>
            <h3>What to measure</h3>
            <p className="muted large">{industry.primaryFunnel.join(" → ")}</p>
          </article>
          <article className="card">
            <p className="eyebrow">PRIORITY KPI FAMILIES</p>
            <h3>Decision metrics</h3>
            <ul className="clean-list">{industry.priorityKpis.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className="card">
            <p className="eyebrow">CHANNELS TO EVALUATE</p>
            <h3>Industry-relevant mix</h3>
            <ul className="clean-list">{industry.channelPriorities.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row-between top-align">
            <div>
              <p className="eyebrow">DATA QUALITY</p>
              <h3>Verify before strong recommendations</h3>
              <p className="muted">AI will not invent these values. Add them to Brand Profile, Knowledge, campaign data or connected providers when available.</p>
            </div>
            <div className="meta-row">
              {industry.dataToVerify.slice(0, 6).map((item) => <span className="pill" key={item}>{item}</span>)}
            </div>
          </div>
        </div>
      </section>

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
