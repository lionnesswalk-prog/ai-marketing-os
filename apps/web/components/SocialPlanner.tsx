"use client";

import { FormEvent, useState } from "react";

type ContentPlan = {
  theme: string;
  posts: Array<{ platform: string; format: string; hook: string; caption: string; cta: string }>;
};

export function SocialPlanner({ disabled = false }: { disabled?: boolean }) {
  const [theme, setTheme] = useState("One-of-one craftsmanship");
  const [objective, setObjective] = useState("Build desire and qualified product discovery");
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) {
      setError("Your workspace role has read-only content access.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: "Lioness Walk",
          theme,
          objective,
          brandVoice: "Composed, feminine, intentional, rare, quiet luxury. Never loud, gimmicky or generic.",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Content generation failed");
      setPlan(body.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Content generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <form className="card form-card" onSubmit={submit}>
        <h2>Content brief</h2>
        <label>Theme<input disabled={disabled} value={theme} onChange={(e) => setTheme(e.target.value)} /></label>
        <label>Objective<textarea disabled={disabled} rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} /></label>
        <button className="btn" disabled={disabled || busy}>{busy ? "Generating…" : "Generate content set"}</button>
        {error && <div className="error-box">{error}</div>}
      </form>

      <div className="stack">
        {!plan && <div className="card empty"><h3>Generate a content set</h3><p className="muted">Hooks and captions stay inside the supplied brand voice and avoid unsupported claims.</p></div>}
        {plan?.posts.map((post, index) => (
          <article className="card" key={`${post.platform}-${index}`}>
            <div className="meta-row"><span className="pill">{post.platform}</span><span className="pill">{post.format}</span></div>
            <h3>{post.hook}</h3>
            <p className="large">{post.caption}</p>
            <p className="muted">CTA · {post.cta}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
