import { canManageMarketing, requireSession } from "../../lib/auth";
import { getSocialAnalytics } from "../../lib/social-analytics";
import { getContentLearningSummary, refreshContentLearning } from "../../lib/content-learning";
import { getLatestWeeklyPerformanceReview } from "../../lib/performance-review";
import { PerformanceReviewCard } from "../../components/PerformanceReviewCard";

const number = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

function value(input?: number) {
  return typeof input === "number" ? number.format(input) : "—";
}

function statusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "needs_permission") return "Permission needed";
  if (status === "not_connected") return "Not connected";
  return "Unavailable";
}

function statusClass(status: string) {
  if (status === "live") return "healthy";
  if (status === "needs_permission") return "watch";
  return "needs_action";
}

export default async function AnalyticsPage() {
  const session = await requireSession();
  let data;
  let learning;
  let weeklyReview;
  try {
    const refreshed = await refreshContentLearning(session);
    data = refreshed.analytics;
    learning = refreshed.summary;
    weeklyReview = await getLatestWeeklyPerformanceReview(session).catch(() => null);
  } catch (error) {
    console.error("analytics learning refresh failed", error);
    data = await getSocialAnalytics();
    learning = await getContentLearningSummary(session).catch(() => ({
      matchedPostCount: 0,
      evidence: "insufficient" as const,
      platformSummaries: [],
      note: "Content learning is not available yet.",
    }));
    weeklyReview = await getLatestWeeklyPerformanceReview(session).catch(() => null);
  }

  const overview = [
    ["Live channels", String(data.liveChannels), "Channels returning live provider data"],
    ["Views", value(data.totals.views), "Video and content views where supported"],
    ["Impressions", value(data.totals.impressions), "Content impressions where supported"],
    ["Engagements", value(data.totals.engagements), "Provider-reported engagement totals"],
    ["Likes", value(data.totals.likes), "Recent/live reported likes"],
    ["Comments", value(data.totals.comments), "Recent/live reported comments"],
  ];

  return (
    <div className="analytics-page">
      <div className="dashboard-hero analytics-hero">
        <div className="hero-copy">
          <p className="eyebrow">SOCIAL INTELLIGENCE</p>
          <h1>Social analytics</h1>
          <p className="muted large">
            Compare channel performance, surface top content, and see exactly which networks are live, disconnected, or waiting on analytics permissions.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{data.liveChannels} live channels</span>
          <span className="pill">Updated {new Date(data.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      <div className="analytics-metrics">
        {overview.map(([label, metric, detail]) => (
          <article className="card analytics-metric" key={label}>
            <span className="analytics-metric-label">{label}</span>
            <strong>{metric}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">AI LEARNING LOOP</p>
            <h2>Learning from your own published content</h2>
          </div>
          <span className={"pill " + (learning.evidence === "learning" ? "accent" : "")}>
            {learning.evidence === "learning" ? "Learning active" : "Building history"} · {learning.matchedPostCount} verified
          </span>
        </div>

        <div className="card learning-overview">
          <div>
            <strong>{learning.matchedPostCount}</strong>
            <span>portal-published posts matched to provider analytics</span>
          </div>
          <p>{learning.note}</p>
          <a className="text-link" href="/studio">Use learning in Brand Studio →</a>
        </div>

        {learning.platformSummaries.length ? (
          <div className="learning-grid">
            {learning.platformSummaries.map((platform) => (
              <article className="card learning-card" key={platform.platform}>
                <div className="analytics-channel-head">
                  <div>
                    <span className="analytics-platform">{platform.platform}</span>
                    <h3>{platform.sampleSize} matched posts</h3>
                  </div>
                  <span className="pill">{platform.sampleSize >= 3 ? "Useful history" : "Sparse sample"}</span>
                </div>
                <div className="learning-examples">
                  {platform.examples.map((example, index) => (
                    <div className="learning-example" key={example.socialPostId}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{example.theme || example.headline}</strong>
                        <small>
                          {example.metrics.views ? value(example.metrics.views) + " views · " : ""}
                          {example.metrics.impressions ? value(example.metrics.impressions) + " impressions · " : ""}
                          {example.metrics.likes ? value(example.metrics.likes) + " likes · " : ""}
                          {example.metrics.comments ? value(example.metrics.comments) + " comments · " : ""}
                          {example.metrics.saves ? value(example.metrics.saves) + " saves" : ""}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card analytics-empty learning-empty">
            <p className="eyebrow">LEARNING HISTORY IS EMPTY</p>
            <h3>Publish through the portal, then let provider analytics accumulate.</h3>
            <p className="muted">The learning loop only learns from posts it can verify against the connected provider account. It will not infer results from unmatched external content.</p>
          </div>
        )}
      </section>

      <PerformanceReviewCard
        initialReview={weeklyReview}
        canRefresh={canManageMarketing(session.role)}
      />

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">CHANNEL COMPARISON</p>
            <h2>Performance by platform</h2>
          </div>
          <a className="text-link" href="/social">Manage connections →</a>
        </div>

        <div className="analytics-channel-grid">
          {data.channels.map((channel) => (
            <article className="card analytics-channel-card" key={channel.platform}>
              <div className="analytics-channel-head">
                <div>
                  <span className="analytics-platform">{channel.name}</span>
                  <h3>{channel.accountLabel || channel.name}</h3>
                </div>
                <span className={`health ${statusClass(channel.availability)}`}>{statusLabel(channel.availability)}</span>
              </div>

              <div className="analytics-stat-grid">
                <div><span>Followers</span><strong>{value(channel.followers)}</strong></div>
                <div><span>Views</span><strong>{value(channel.views)}</strong></div>
                <div><span>Impressions</span><strong>{value(channel.impressions)}</strong></div>
                <div><span>Engagements</span><strong>{value(channel.engagements)}</strong></div>
                <div><span>Likes</span><strong>{value(channel.likes)}</strong></div>
                <div><span>Comments</span><strong>{value(channel.comments)}</strong></div>
                <div><span>Shares</span><strong>{value(channel.shares)}</strong></div>
                <div><span>Posts</span><strong>{value(channel.posts)}</strong></div>
              </div>

              {channel.note && <p className="analytics-note">{channel.note}</p>}
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">TOP CONTENT</p>
            <h2>Best-performing recent content</h2>
          </div>
          <span className="pill">{data.topContent.length} items</span>
        </div>

        {data.topContent.length ? (
          <div className="analytics-top-list">
            {data.topContent.map((item, index) => (
              <article className="card analytics-content-card" key={`${item.platform}-${item.id}`}>
                <span className="analytics-rank">{String(index + 1).padStart(2, "0")}</span>
                <div className="analytics-content-main">
                  <div className="meta-row">
                    <span className="pill">{item.platform}</span>
                    {item.url && <a className="text-link compact-link" href={item.url} target="_blank" rel="noreferrer">Open post ↗</a>}
                  </div>
                  <h3>{item.title}</h3>
                </div>
                <div className="analytics-content-stats">
                  <div><span>Views</span><strong>{value(item.views)}</strong></div>
                  <div><span>Impressions</span><strong>{value(item.impressions)}</strong></div>
                  <div><span>Likes</span><strong>{value(item.likes)}</strong></div>
                  <div><span>Comments</span><strong>{value(item.comments)}</strong></div>
                  <div><span>Shares</span><strong>{value(item.shares)}</strong></div>
                  <div><span>Saves</span><strong>{value(item.saves)}</strong></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card analytics-empty">
            <p className="eyebrow">NO LIVE CONTENT METRICS YET</p>
            <h3>Connect or re-authorize a supported social account.</h3>
            <p className="muted">Once provider permissions are available, recent content performance appears here automatically.</p>
            <a className="btn" href="/social">Open Social Hub</a>
          </div>
        )}
      </section>
    </div>
  );
}
