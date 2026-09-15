import { requireSession } from "../../lib/auth";
import { LeadDraftButton } from "../../components/LeadDraftButton";
import { listLeads } from "../../lib/repository";

export default async function Leads() {
  await requireSession();
  const leads = await listLeads();
  return (
    <div>
      <p className="eyebrow">INQUIRIES</p>
      <h1>Leads & customer conversations</h1>
      <p className="muted large">The inquiry agent drafts replies from verified facts and refuses to invent stock, delivery, discount or exclusivity claims.</p>
      <div className="stack">
        {!leads.length && (
          <div className="card empty">
            <p className="eyebrow">NO INQUIRIES YET</p>
            <h3>Lead conversations will appear here.</h3>
            <p className="muted">Connect supported lead sources or import campaign/customer inquiry data to start using safe AI reply drafting.</p>
            <a className="text-link" href="/social">Manage connections →</a>
          </div>
        )}
        {leads.map((lead) => <article className="card" key={lead.id}>
          <div className="row-between top-align">
            <div className="lead-main">
              <div className="meta-row"><span className="pill">{lead.source}</span><span className={`intent ${lead.intent}`}>{lead.intent} intent</span><span className="pill">{lead.status.replace("_", " ")}</span></div>
              <h3>{lead.customerName ?? lead.id}</h3>
              <p className="large">{lead.message}</p>
              {lead.productInterest && <p className="muted">Interest · {lead.productInterest}</p>}
            </div>
            <LeadDraftButton message={lead.message} />
          </div>
        </article>)}
      </div>
    </div>
  );
}
