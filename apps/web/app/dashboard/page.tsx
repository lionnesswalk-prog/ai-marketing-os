import { dashboardData } from "../../lib/repository";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Dashboard() {
  const data = await dashboardData();
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
      <div className="page-head">
        <div>
          <p className="eyebrow">COMMAND CENTER</p>
          <h1>Marketing overview</h1>
          <p className="muted large">Paid media, social content, leads and approval-gated AI recommendations in one operating view.</p>
        </div>
        <span className="pill">Memory demo data</span>
      </div>

      <div className="metric-grid">
        {metrics.map(([key, value]) => (
          <div className="card metric-card" key={key}>
            <div className="muted">{key}</div>
            <div className="metric">{value}</div>
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
