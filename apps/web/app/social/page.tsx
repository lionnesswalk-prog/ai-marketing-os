import { requireSession } from "../../lib/auth";
import { SocialPlanner } from "../../components/SocialPlanner";
import { SocialPublisher } from "../../components/SocialPublisher";
import { listSocialPosts } from "../../lib/repository";
import { getSocialPlatforms } from "../../lib/social-platforms";
import { TikTokStatusButton } from "../../components/TikTokStatusButton";

function integrationNotice(meta?: string, linkedin?: string, x?: string, tiktok?: string) {
  if (meta === "connected") return { tone: "success", text: "Meta connected successfully. Facebook and the linked Instagram professional account are ready for supported live publishing." };
  if (meta === "disconnected") return { tone: "success", text: "Meta connection removed." };
  if (meta === "app-required") return { tone: "error", text: "Meta App ID and App Secret still need to be added to the production environment before account authorization can start." };
  if (meta === "storage-required") return { tone: "error", text: "Secure Meta OAuth storage needs PostgreSQL plus AUTH_SECRET or INTEGRATION_ENCRYPTION_KEY before live account connection can be enabled." };
  if (meta === "cancelled") return { tone: "error", text: "Meta connection was cancelled before permissions were approved." };
  if (meta === "invalid-state") return { tone: "error", text: "Meta authorization could not be verified. Please start the connection again from this page." };
  if (meta === "failed") return { tone: "error", text: "Meta authorization failed. Check the Meta app permissions and redirect URL, then connect again." };

  if (linkedin === "connected") return { tone: "success", text: "LinkedIn connected successfully. Text and article-link posts can now publish directly from the Social Hub." };
  if (linkedin === "disconnected") return { tone: "success", text: "LinkedIn connection removed." };
  if (linkedin === "setup-required") return { tone: "error", text: "LinkedIn connection needs PostgreSQL, secure integration encryption, and LinkedIn Client ID/Secret before authorization can start." };
  if (linkedin === "cancelled") return { tone: "error", text: "LinkedIn connection was cancelled before permissions were approved." };
  if (linkedin === "invalid-state") return { tone: "error", text: "LinkedIn authorization could not be verified. Start the connection again from this page." };
  if (linkedin === "failed") return { tone: "error", text: "LinkedIn authorization failed. Check the LinkedIn app products, scopes and redirect URL, then connect again." };

  if (x === "connected") return { tone: "success", text: "X connected successfully. Text and link posts can now publish directly from the Social Hub." };
  if (x === "disconnected") return { tone: "success", text: "X connection removed." };
  if (x === "setup-required") return { tone: "error", text: "X connection needs PostgreSQL, secure integration encryption, and an X Client ID before authorization can start." };
  if (x === "cancelled") return { tone: "error", text: "X connection was cancelled before permissions were approved." };
  if (x === "invalid-state") return { tone: "error", text: "X authorization could not be verified. Start the connection again from this page." };
  if (x === "failed") return { tone: "error", text: "X authorization failed. Check the X app OAuth settings, scopes and callback URL, then connect again." };

  if (tiktok === "connected") return { tone: "success", text: "TikTok connected successfully. Video posts can be submitted directly after choosing the creator privacy setting." };
  if (tiktok === "disconnected") return { tone: "success", text: "TikTok connection removed." };
  if (tiktok === "setup-required") return { tone: "error", text: "TikTok connection needs PostgreSQL, secure integration encryption, and TikTok Client Key/Secret before authorization can start." };
  if (tiktok === "cancelled") return { tone: "error", text: "TikTok connection was cancelled before permissions were approved." };
  if (tiktok === "invalid-state") return { tone: "error", text: "TikTok authorization could not be verified. Start the connection again from this page." };
  if (tiktok === "failed") return { tone: "error", text: "TikTok authorization failed. Check the Content Posting API product, video.publish scope and redirect URL." };
  return null;
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams?: Promise<{ meta?: string; linkedin?: string; x?: string; tiktok?: string }>;
}) {
  await requireSession();
  const params = searchParams ? await searchParams : undefined;
  const notice = integrationNotice(params?.meta, params?.linkedin, params?.x, params?.tiktok);
  const [scheduled, platforms] = await Promise.all([
    listSocialPosts(),
    getSocialPlatforms(),
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

      {notice && <div className={`profile-notice social-notice ${notice.tone}`}>{notice.text}</div>}

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
                <span className={`health ${post.status === "scheduled" || post.status === "published" ? "healthy" : post.status === "failed" ? "needs-action" : "watch"}`}>{post.status}</span>
              </div>
              <h3>{post.title}</h3>
              <p className="muted large">{post.caption || "No caption added yet."}</p>
              {post.hashtags && <p className="social-hashtags">{post.hashtags}</p>}
              <div className="social-queue-meta">
                {post.cta && <span>CTA · {post.cta}</span>}
                {post.scheduledAt && <span>Scheduled · {new Date(post.scheduledAt).toLocaleString("en-IN")}</span>}
                {post.mediaUrl && <a href={post.mediaUrl} target="_blank" rel="noreferrer">Open media ↗</a>}
                {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer">Open destination ↗</a>}
                {post.platform === "tiktok" && post.status === "publishing" && post.externalId && <TikTokStatusButton postId={post.id} />}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
