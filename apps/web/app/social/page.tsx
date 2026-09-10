import { requireSession } from "../../lib/auth";
import { SocialPlanner } from "../../components/SocialPlanner";
import { listSocialPosts } from "../../lib/repository";

export default async function SocialPage() {
  await requireSession();
  const scheduled = await listSocialPosts();
  return (
    <div>
      <p className="eyebrow">SOCIAL MEDIA</p>
      <h1>Content planner</h1>
      <p className="muted large">Generate brand-aligned social concepts now; platform publishing adapters come in the integration milestone.</p>
      <SocialPlanner />
      <section>
        <div className="section-head"><div><p className="eyebrow">QUEUE</p><h2>Current content</h2></div></div>
        <div className="stack">
          {scheduled.map((post) => <article className="card" key={post.id}><div className="meta-row"><span className="pill">{post.platform}</span><span className="pill">{post.contentType}</span><span className={`health ${post.status === "scheduled" ? "healthy" : "watch"}`}>{post.status}</span></div><h3>{post.title}</h3><p className="muted large">{post.caption}</p>{post.scheduledAt && <p className="muted">Scheduled · {new Date(post.scheduledAt).toLocaleString("en-IN")}</p>}</article>)}
        </div>
      </section>
    </div>
  );
}
