import { redirect } from "next/navigation";
import { canManageMarketing, requireSession } from "../../lib/auth";
import { addKnowledgeItem, listKnowledgeItems, removeKnowledgeItem } from "../../lib/knowledge";

async function addAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "reference").trim();
  const content = String(formData.get("content") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const verified = String(formData.get("verified") ?? "") === "on";

  if (title.length < 2 || content.length < 3) redirect("/knowledge?status=invalid");
  if (sourceUrl) {
    try { new URL(sourceUrl); } catch { redirect("/knowledge?status=url"); }
  }

  try {
    await addKnowledgeItem(session, { title, kind, content, sourceUrl, verified });
    redirect("/knowledge?status=saved");
  } catch {
    redirect("/knowledge?status=failed");
  }
}

async function deleteAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/knowledge?status=failed");
  try {
    await removeKnowledgeItem(session, id);
    redirect("/knowledge?status=deleted");
  } catch {
    redirect("/knowledge?status=failed");
  }
}

function notice(status?: string) {
  if (status === "saved") return { tone: "success", text: "Knowledge saved. AI will use it with the selected verification level." };
  if (status === "deleted") return { tone: "success", text: "Knowledge item deleted." };
  if (status === "invalid") return { tone: "error", text: "Add a title and useful knowledge content." };
  if (status === "url") return { tone: "error", text: "Source URL is not valid." };
  if (status === "failed") return { tone: "error", text: "Unable to update the knowledge base." };
  return null;
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const canEdit = canManageMarketing(session.role);
  const items = await listKnowledgeItems(session);
  const params = searchParams ? await searchParams : undefined;
  const message = notice(params?.status);
  const verifiedCount = items.filter((item) => item.verified).length;

  return (
    <div>
      <div className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">VERIFIED KNOWLEDGE</p>
          <h1>Give AI the facts it is allowed to trust.</h1>
          <p className="muted large">
            Store product facts, policies, pricing rules, proof, campaign learnings and operating context inside this workspace. Verified items are treated as brand facts; reference notes remain explicitly unverified.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{verifiedCount} verified</span>
          <span className="pill">{items.length} total items</span>
        </div>
      </div>

      {message && <div className={"profile-notice " + message.tone}>{message.text}</div>}

      <div className="two-col">
        <section className="card form-card">
          <p className="eyebrow">ADD KNOWLEDGE</p>
          <h2>Workspace source of truth</h2>
          <p className="muted">Only mark an item verified when your team knows it is current and correct.</p>
          <form action={addAction}>
            <label>Title<input name="title" minLength={2} maxLength={160} required placeholder="Shipping policy, hero product facts, campaign learning..." disabled={!canEdit} /></label>
            <label>Type
              <select name="kind" defaultValue="reference" disabled={!canEdit}>
                <option value="product">Product / service</option>
                <option value="policy">Policy</option>
                <option value="pricing">Pricing / commercial rule</option>
                <option value="proof">Proof / credential</option>
                <option value="audience">Audience insight</option>
                <option value="campaign">Campaign learning</option>
                <option value="reference">General reference</option>
              </select>
            </label>
            <label>Knowledge<textarea name="content" rows={8} maxLength={6000} required placeholder="Write the exact fact or operating context AI should use." disabled={!canEdit} /></label>
            <label>Source URL · optional<input name="sourceUrl" type="url" placeholder="https://..." disabled={!canEdit} /></label>
            <label style={{ display: "flex", gridTemplateColumns: "auto 1fr", alignItems: "start", gap: 10 }}>
              <input name="verified" type="checkbox" style={{ width: 18, marginTop: 2 }} disabled={!canEdit} />
              <span>I confirm this item is current and verified by our team.</span>
            </label>
            <button className="btn" disabled={!canEdit} type="submit">Save knowledge</button>
          </form>
        </section>

        <section>
          <div className="section-head">
            <div><p className="eyebrow">CURRENT CONTEXT</p><h2>Saved knowledge</h2></div>
            <span className="pill">Workspace only</span>
          </div>
          <div className="stack">
            {!items.length && (
              <article className="card empty">
                <h3>No workspace knowledge yet</h3>
                <p className="muted">Add verified facts before asking AI to make product, policy or performance-specific claims.</p>
              </article>
            )}
            {items.map((item) => (
              <article className="card" key={item.id}>
                <div className="meta-row">
                  <span className="pill">{item.kind}</span>
                  <span className={"health " + (item.verified ? "healthy" : "watch")}>{item.verified ? "Verified" : "Reference"}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="large" style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>
                {item.sourceUrl && <p><a className="text-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></p>}
                {canEdit && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="btn secondary" type="submit">Delete</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
