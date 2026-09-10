import { requireSession } from "../../lib/auth";
import { listCampaigns } from "../../lib/repository";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Campaigns() {
  await requireSession();
  const campaigns = await listCampaigns();
  return (
    <div>
      <p className="eyebrow">PAID MEDIA</p>
      <h1>Campaign intelligence</h1>
      <p className="muted large">Deterministic diagnostics run before any AI recommendation. Spend changes remain approval-gated.</p>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Campaign</th><th>Channel</th><th>Spend</th><th>CTR</th><th>CVR</th><th>ROAS</th><th>Health</th></tr></thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td><strong>{campaign.name}</strong><div className="muted">Budget {money.format(campaign.dailyBudget ?? 0)}/day</div></td>
                <td>{campaign.channel}</td>
                <td>{money.format(campaign.spend)}</td>
                <td>{(campaign.diagnosis.metrics.ctr * 100).toFixed(2)}%</td>
                <td>{(campaign.diagnosis.metrics.conversionRate * 100).toFixed(2)}%</td>
                <td>{campaign.diagnosis.metrics.roas.toFixed(2)}x</td>
                <td><span className={`health ${campaign.diagnosis.health}`}>{campaign.diagnosis.health.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <div className="section-head"><div><p className="eyebrow">DIAGNOSIS</p><h2>Recommended actions</h2></div></div>
        <div className="stack">
          {campaigns.flatMap((campaign) => campaign.diagnosis.actions.map((action) => (
            <article className="card" key={`${campaign.id}-${action.action}`}>
              <div className="row-between">
                <div>
                  <span className="pill">{campaign.name}</span>
                  <h3>{action.action.replaceAll("_", " ")}</h3>
                  <p className="muted large">{action.reason}</p>
                </div>
                <div className="action-meta">
                  <strong>{Math.round(action.confidence * 100)}%</strong>
                  <span className="muted">confidence</span>
                  {action.requiresApproval && <span className="approval-tag">Approval required</span>}
                </div>
              </div>
            </article>
          )))}
        </div>
      </section>
    </div>
  );
}
