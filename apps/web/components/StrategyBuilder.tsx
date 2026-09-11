"use client";

import { FormEvent, useState } from "react";

type StrategyPlan = {
  objective: string;
  audienceSegments: string[];
  channelMix: Array<{ channel: string; budgetPct: number; estimatedAmount?: number }>;
  creativeAngles: string[];
  kpis: string[];
  testPlan: string[];
  risks: string[];
  assumptions: string[];
};

export function StrategyBuilder({
  brandName,
  disabled = false,
}: {
  brandName: string;
  disabled?: boolean;
}) {
  const [budget, setBudget] = useState(100000);
  const [objective, setObjective] = useState("Increase qualified demand over the next 30 days");
  const [product, setProduct] = useState("");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) {
      setError("Your workspace role has read-only strategy access.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ budget, objective, product, notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not build strategy");
      setPlan(body.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build strategy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <form className="card form-card" onSubmit={submit}>
        <h2>{brandName} campaign brief</h2>
        <label>Monthly budget (INR)<input disabled={disabled} type="number" min={1000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label>
        <label>Objective<textarea disabled={disabled} value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} /></label>
        <label>Product / service / offer<textarea disabled={disabled} value={product} onChange={(e) => setProduct(e.target.value)} rows={3} placeholder="What are we promoting?" /></label>
        <label>Additional campaign notes<textarea disabled={disabled} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Launch date, geography, constraints, offer details..." /></label>
        <button className="btn" disabled={disabled || busy}>{busy ? "Building…" : "Generate 30-day plan"}</button>
        <p className="muted">Brand Profile context is added server-side. Mock mode works without API credentials.</p>
        {error && <div className="error-box">{error}</div>}
      </form>

      <div className="stack">
        {!plan && <div className="card empty"><h3>Your plan will appear here</h3><p className="muted">Channel allocation, audience, creative angles, KPIs, tests and risks.</p></div>}
        {plan && <>
          <div className="card"><p className="eyebrow">CHANNEL MIX</p><h2>{plan.objective}</h2>
            <div className="allocation-list">{plan.channelMix.map((item) => <div className="allocation" key={item.channel}><span>{item.channel}</span><strong>{item.budgetPct}%{item.estimatedAmount ? ` · ₹${item.estimatedAmount.toLocaleString("en-IN")}` : ""}</strong></div>)}</div>
          </div>
          <PlanList title="Audience segments" items={plan.audienceSegments} />
          <PlanList title="Creative angles" items={plan.creativeAngles} />
          <PlanList title="Test plan" items={plan.testPlan} />
          <PlanList title="KPIs" items={plan.kpis} />
          <PlanList title="Risks & assumptions" items={[...plan.risks, ...plan.assumptions]} />
        </>}
      </div>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return <div className="card"><h3>{title}</h3><ul className="clean-list">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
