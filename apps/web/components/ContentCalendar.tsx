"use client";

import { useMemo, useState } from "react";

type CalendarItem = {
  id: string;
  dayOffset: number;
  platform: "instagram" | "facebook" | "pinterest";
  theme: string;
  headline: string;
  subheadline: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  postingWindow: "morning" | "midday" | "evening";
  timingReason: string;
  timingEvidence: "performance" | "test";
  socialPostId?: string;
};

type CalendarPlan = {
  id: string;
  horizonDays: number;
  objective: string;
  focus: string;
  aiMode?: string;
  createdAt: string;
  updatedAt: string;
  items: CalendarItem[];
};

function platformLabel(value: CalendarItem["platform"]) {
  if (value === "instagram") return "Instagram";
  if (value === "facebook") return "Facebook";
  return "Pinterest";
}

function windowHour(window: CalendarItem["postingWindow"]) {
  if (window === "morning") return 9;
  if (window === "midday") return 13;
  return 19;
}

function scheduledDate(item: CalendarItem) {
  const now = new Date();
  const date = new Date(now);
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + item.dayOffset);
  date.setHours(windowHour(item.postingWindow), 0, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

function calendarDate(item: CalendarItem) {
  return scheduledDate(item).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ContentCalendar({
  initialPlan,
  canManage,
}: {
  initialPlan: CalendarPlan | null;
  canManage: boolean;
}) {
  const [horizonDays, setHorizonDays] = useState<7 | 30>(
    initialPlan?.horizonDays === 30 ? 30 : 7,
  );
  const [objective, setObjective] = useState(initialPlan?.objective || "");
  const [focus, setFocus] = useState(initialPlan?.focus || "");
  const [plan, setPlan] = useState<CalendarPlan | null>(initialPlan);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState<"generate" | "drafts" | "schedule" | null>(null);
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const performanceCount = useMemo(
    () => plan?.items.filter((item) => item.timingEvidence === "performance").length || 0,
    [plan],
  );

  async function generate() {
    setBusy("generate");
    setNotice("");
    setWarning("");
    setError("");
    setStatuses({});
    try {
      const response = await fetch("/api/content-calendar/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          horizonDays,
          objective,
          focus: focus || undefined,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to generate content calendar.");
      setPlan(body.plan);
      setSummary(body.summary || "");
      setWarning(body.warning || (body.mode === "mock" ? "Safe built-in planning mode is active." : ""));
      const learnedPosts = Number(body.learning?.matchedPostCount || 0);
      const timingIsPerformanceInformed = body.plan.items.some(
        (item: CalendarItem) => item.timingEvidence === "performance",
      );
      setNotice(
        learnedPosts >= 3
          ? `Calendar generated using ${learnedPosts} verified post-performance matches plus ${timingIsPerformanceInformed ? "available performance-informed timing" : "controlled test timing"}.`
          : timingIsPerformanceInformed
            ? "Calendar generated with available recent account-performance timing signals. Content-theme learning is still building history."
            : "Calendar generated with test timing and exploratory content. As verified post history grows, the learning loop will influence future plans.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate content calendar.");
    } finally {
      setBusy(null);
    }
  }

  async function apply(mode: "drafts" | "schedule") {
    if (!plan) return;
    setBusy(mode);
    setNotice("");
    setWarning("");
    setError("");
    try {
      const schedule = mode === "schedule"
        ? Object.fromEntries(plan.items.map((item) => [item.id, scheduledDate(item).toISOString()]))
        : undefined;

      const response = await fetch("/api/content-calendar/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id, schedule }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to apply this calendar.");

      const nextStatuses: Record<string, string> = {};
      const postByItem = new Map<string, string>();
      for (const result of body.results || []) {
        nextStatuses[result.itemId] =
          result.status === "scheduled" ? "Scheduled" :
          result.status === "schedule_failed" ? "Draft · setup needed" :
          "Draft ready";
        if (result.socialPostId) postByItem.set(result.itemId, result.socialPostId);
      }
      setStatuses(nextStatuses);
      setPlan((current) => current ? {
        ...current,
        items: current.items.map((item) => ({
          ...item,
          socialPostId: postByItem.get(item.id) || item.socialPostId,
        })),
      } : current);
      setNotice(body.message || "Calendar applied.");
      const warnings = (body.results || [])
        .filter((item: { warning?: string }) => item.warning)
        .map((item: { warning: string }) => item.warning);
      if (warnings.length) {
        setWarning("Some posts need Social Hub setup before scheduling. They were kept safely as drafts.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply this calendar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card calendar-card">
      <div className="section-head top-align">
        <div>
          <p className="eyebrow">AI CONTENT CALENDAR</p>
          <h2>Plan the week or month, then turn it into posts.</h2>
          <p className="muted">
            Timing uses this brand&apos;s recent timestamped engagement when enough data exists. Otherwise the portal labels timing as a controlled test rather than pretending it knows a best time.
          </p>
        </div>
        {plan && (
          <span className={"pill " + (performanceCount ? "accent" : "")}>
            {performanceCount ? performanceCount + " performance-informed" : "Test timing"}
          </span>
        )}
      </div>

      <div className="calendar-controls">
        <div className="calendar-horizon">
          <button type="button" className={horizonDays === 7 ? "active" : ""} onClick={() => setHorizonDays(7)}>7 days · 4 posts</button>
          <button type="button" className={horizonDays === 30 ? "active" : ""} onClick={() => setHorizonDays(30)}>30 days · 12 posts</button>
        </div>
        <div className="studio-form-grid">
          <label>Calendar objective
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Build awareness, drive product discovery, increase qualified inquiries..." />
          </label>
          <label>Focus · optional
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Collection, service, launch, audience theme..." />
          </label>
        </div>
        <button className="btn" type="button" disabled={!canManage || busy !== null || objective.trim().length < 3} onClick={generate}>
          {busy === "generate" ? "Building calendar…" : "Generate AI calendar"}
        </button>
      </div>

      {plan && (
        <>
          <div className="calendar-meta">
            <span>{plan.horizonDays}-day plan</span>
            <span>{plan.items.length} posts</span>
            <span>Created {new Date(plan.createdAt).toLocaleDateString()}</span>
          </div>

          {summary && <p className="calendar-summary">{summary}</p>}

          <div className="calendar-list">
            {plan.items.map((item, index) => (
              <article className="calendar-item" key={item.id}>
                <div className="calendar-date">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{calendarDate(item)}</strong>
                </div>
                <div className="calendar-content">
                  <div className="meta-row">
                    <span className="pill">{platformLabel(item.platform)}</span>
                    <span className={"pill " + (item.timingEvidence === "performance" ? "accent" : "")}>
                      {item.timingEvidence === "performance" ? "Performance-informed timing" : "Test timing"}
                    </span>
                    {(statuses[item.id] || item.socialPostId) && (
                      <span className="pill">{statuses[item.id] || "Draft created"}</span>
                    )}
                  </div>
                  <h3>{item.headline}</h3>
                  <p className="muted">{item.theme}</p>
                  <p className="calendar-caption">{item.caption}</p>
                  <details>
                    <summary>Why this time?</summary>
                    <p>{item.timingReason}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>

          <div className="calendar-actions">
            <button className="btn secondary" type="button" disabled={!canManage || busy !== null} onClick={() => apply("drafts")}>
              {busy === "drafts" ? "Creating drafts…" : "Create all as drafts"}
            </button>
            <button className="btn" type="button" disabled={!canManage || busy !== null} onClick={() => apply("schedule")}>
              {busy === "schedule" ? "Scheduling plan…" : "Schedule full plan"}
            </button>
            <a className="text-link" href="/social">Open Social Hub →</a>
          </div>
        </>
      )}

      {!canManage && <p className="muted">Read-only access · an Admin or Marketing Manager can generate and apply calendar plans.</p>}
      {notice && <div className="profile-notice success">{notice}</div>}
      {warning && <div className="profile-notice">{warning}</div>}
      {error && <div className="profile-notice error">{error}</div>}
    </section>
  );
}
