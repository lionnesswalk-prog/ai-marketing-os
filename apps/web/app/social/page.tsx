import { requireSession } from "../../lib/auth";
import { SocialPlanner } from "../../components/SocialPlanner";
import { SocialPublisher } from "../../components/SocialPublisher";
import { listSocialPosts } from "../../lib/repository";
import { getSocialPlatforms } from "../../lib/social-platforms";

export default async function SocialPage() {
  await requireSession();
  const [scheduled, platforms] = await Promise.all([
    listSocialPosts(),
    Promise.resolve(getSocialPlatforms()),
  ]);

  return (
    <div className="social-page">
      <div className="dashboard-hero social-hero">
        <div className="hero-copy">
          <p className="eyebrow">SOCIAL COMMAND CENTER</p>
          <h1>Plan, create and publish from one place.</h1>
          <p className="muted large">Open every social channel directly, prepare captions and media, schedule posts, and move from AI ideas to publishing without leaving the portal.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">Multi-channel publisher</span>
          <span className="pill">AI-assisted content</span>
        </div>
      </div>

      <SocialPublisher platforms={platforms} />

      <section>
        <div className="section-head">
          <div><p className="eyebrow">AI CONTENT STUDIO</p><h2>Generate campaign-ready social ideas</h2></div>
          <span className="pill">Lioness Walk voice</span>
        </div>
        <SocialPlanner />
      </section>

      <section>
        <div className="section-head"><div><p className="eyebrow">PUBLISHING QUEUE</p><h2>Current content</h2></div><span className="pill">{scheduled.length} posts</span></div>
        <div className="social-queue-grid">
          {scheduled.map((post) => (
            <article className="card social-queue-card" key={post.id}>
              <div className="meta-row">
                <span className="pill">{post.platform}</span>
                <span className="pill">{post.contentType}</span>
                <span className={`health ${post.status === "scheduled" || post.status === "published" ? "healthy" : "watch"}`}>{post.status}</span>
              </div>
              <h3>{post.title}</h3>
              <p className="muted large">{post.caption || "No caption added yet."}</p>
              {post.hashtags && <p className="social-hashtags">{post.hashtags}</p>}
              <div className="social-queue-meta">
                {post.cta && <span>CTA · {post.cta}</span>}
                {post.scheduledAt && <span>Scheduled · {new Date(post.scheduledAt).toLocaleString("en-IN")}</span>}
                {post.mediaUrl && <a href={post.mediaUrl} target="_blank" rel="noreferrer">Open media ↗</a>}
                {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer">Open destination ↗</a>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
