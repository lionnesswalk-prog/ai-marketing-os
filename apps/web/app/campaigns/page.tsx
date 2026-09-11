import { canManageMarketing, requireSession } from "../../lib/auth";
import { CampaignBuilder } from "../../components/CampaignBuilder";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { listCampaigns } from "../../lib/repository";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function Campaigns() {
  const session = await requireSession();
  const [campaigns, profile] = await Promise.all([
    listCampaigns(),
    getCurrentBrandProfile(session),
  ]);
  const liveCampaigns = campaigns.filter((campaign) => campaign.status !== "draft");

  return (
    <div>
      <div className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">PAID MEDIA</p>
          <h1>Campaign intelligence</h1>
          <p className="muted large">Plan campaign drafts, review imported live performance and keep spend-impacting actions approval-gated.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{profile.name}</span>
          <span className="pill">{campaigns.filter((item) => item.status === "draft").length} drafts</span>
          <span className="pill">{liveCampaigns.length} live records</span>
        </div>
      </div>

      <CampaignBuilder brandName={profile.name} canManage={canManageMarketing(session.role)} />

      <section>
        <div className="section-head">
          <div><p className="eyebrow">CAMPAIGN RECORDS</p><h2>Drafts & performance</h2></div>
          <span className="pill">{campaigns.length} campaigns</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Status</th><th>Channel</th><th>Spend</th><th>CTR</th><th>CVR</th><th>ROAS</th><th>Health</th></tr></thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td><strong>{campaign.name}</strong><div className="muted">Budget {money.format(campaign.dailyBudget ?? 0)}/day</div></td>
                  <td><span className={campaign.status === "draft" ? "pill" : campaign.status === "active" ? "health healthy" : "health watch"}>{campaign.status || "unknown"}</span></td>
                  <td>{campaign.channel}</td>
                  <td>{money.format(campaign.spend)}</td>
                  <td>{(campaign.diagnosis.metrics.ctr * 100).toFixed(2)}%</td>
                  <td>{(campaign.diagnosis.metrics.conversionRate * 100).toFixed(2)}%</td>
                  <td>{campaign.diagnosis.metrics.roas.toFixed(2)}x</td>
                  <td>{campaign.status === "draft" ? <span className="pill">Not launched</span> : <span className={`health ${campaign.diagnosis.health}`}>{campaign.diagnosis.health.replace("_", " ")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section-head"><div><p className="eyebrow">DIAGNOSIS</p><h2>Recommended actions</h2></div></div>
        <div className="stack">
          {liveCampaigns.flatMap((campaign) => campaign.diagnosis.actions.map((action) => (
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
          {liveCampaigns.length === 0 && <div className="card empty"><h3>No live campaign metrics yet</h3><p className="muted">Drafts stay internal until a real provider campaign is connected or imported.</p></div>}
        </div>
      </section>
    </div>
  );
}
