"use client";

import { useState } from "react";

type ReviewView = {
  id: string;
  periodKey: string;
  periodEnd: string;
  aiMode?: string;
  updatedAt: string;
  evidence: {
    matchedPublishedPosts: number;
    comparisons: Array<{
      platform: string;
      recent7Count: number;
      previous7Count: number;
      sevenDayDeltaPct?: number;
      recent30Count: number;
      previous30Count: number;
      thirtyDayDeltaPct?: number;
    }>;
  };
  review: {
    evidenceStatus: "learning" | "insufficient";
    headline: string;
    executiveSummary: string;
    improvements: Array<{ title: string; evidence: string }>;
    weakSignals: Array<{ title: string; evidence: string }>;
    experiments: Array<{ hypothesis: string; action: string; successSignal: string }>;
    nextWeekPriorities: string[];
  };
};

function delta(value?: number) {
  if (typeof value !== "number") return "Not enough comparable posts";
  return (value > 0 ? "+" : "") + value.toFixed(1) + "% observed";
}

export function PerformanceReviewCard({
  initialReview,
  canRefresh,
}: {
  initialReview: ReviewView | null;
  canRefresh: boolean;
}) {
  const [review, setReview] = useState<ReviewView | null>(initialReview);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/performance-review/generate", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to refresh review.");
      setReview(body.review);
      setNotice(body.review.warning || "Weekly performance review refreshed with the latest verified evidence.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="section-head top-align">
        <div>
          <p className="eyebrow">WEEKLY AI PERFORMANCE REVIEW</p>
          <h2>What changed, what looks weak, and what to test next</h2>
          <p className="muted">The review compares verified same-platform post cohorts. It treats newer posts as less mature and does not turn correlation into causal claims.</p>
        </div>
        {canRefresh && (
          <button className="btn secondary" type="button" disabled={busy} onClick={refresh}>
            {busy ? "Refreshing…" : "Refresh review"}
          </button>
        )}
      </div>

      {review ? (
        <div className="card performance-review-card">
          <div className="performance-review-head">
            <div>
              <span className={"pill " + (review.review.evidenceStatus === "learning" ? "accent" : "")}>
                {review.review.evidenceStatus === "learning" ? "Evidence-backed review" : "Sparse-data review"}
              </span>
              <h3>{review.review.headline}</h3>
              <p>{review.review.executiveSummary}</p>
            </div>
            <div className="performance-review-meta">
              <strong>{review.evidence.matchedPublishedPosts}</strong>
              <span>verified posts in the 60-day evidence window</span>
              <small>Week of {review.periodKey}</small>
            </div>
          </div>

          {review.evidence.comparisons.length > 0 && (
            <div className="review-comparison-grid">
              {review.evidence.comparisons.map((item) => (
                <div key={item.platform}>
                  <strong>{item.platform}</strong>
                  <span>7d: {delta(item.sevenDayDeltaPct)} · {item.recent7Count} vs {item.previous7Count} posts</span>
                  <span>30d: {delta(item.thirtyDayDeltaPct)} · {item.recent30Count} vs {item.previous30Count} posts</span>
                </div>
              ))}
            </div>
          )}

          <div className="review-columns">
            <div>
              <p className="eyebrow">OBSERVED IMPROVEMENTS</p>
              {review.review.improvements.length ? review.review.improvements.map((item) => (
                <article className="review-signal" key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.evidence}</p>
                </article>
              )) : <p className="muted">No improvement signal is strong enough to call out yet.</p>}
            </div>
            <div>
              <p className="eyebrow">WEAK / UNCERTAIN SIGNALS</p>
              {review.review.weakSignals.length ? review.review.weakSignals.map((item) => (
                <article className="review-signal" key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.evidence}</p>
                </article>
              )) : <p className="muted">No material weak signal is supported by the current verified sample.</p>}
            </div>
          </div>

          <div className="review-experiments">
            <p className="eyebrow">NEXT-WEEK EXPERIMENTS</p>
            {review.review.experiments.map((item, index) => (
              <article key={item.hypothesis}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.hypothesis}</strong>
                  <p>{item.action}</p>
                  <small>Success signal: {item.successSignal}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="review-priorities">
            <p className="eyebrow">NEXT-WEEK PRIORITIES</p>
            <ol>
              {review.review.nextWeekPriorities.map((item) => <li key={item}>{item}</li>)}
            </ol>
            <a className="text-link" href="/studio">Turn this into a Content Calendar →</a>
          </div>
        </div>
      ) : (
        <div className="card analytics-empty review-empty">
          <p className="eyebrow">FIRST REVIEW NOT GENERATED YET</p>
          <h3>The automatic review will appear after the weekly maintenance run.</h3>
          <p className="muted">You can also refresh it now. If verified post history is still sparse, the review will focus on evidence-building experiments instead of declaring winners.</p>
          {canRefresh && <button className="btn" type="button" disabled={busy} onClick={refresh}>{busy ? "Generating…" : "Generate first review"}</button>}
        </div>
      )}

      {notice && <div className="profile-notice success">{notice}</div>}
      {error && <div className="profile-notice error">{error}</div>}
    </section>
  );
}
