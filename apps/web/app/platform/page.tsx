import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { getPlatformReadiness } from "../../lib/platform-readiness";

function stateLabel(ready: boolean) {
  return ready ? "Ready" : "Needs setup";
}

export default async function PlatformPage() {
  const session = await requireSession();
  if (!session.platformAdmin) redirect("/dashboard");

  const data = await getPlatformReadiness();

  return (
    <div className="platform-page">
      <div className="dashboard-hero platform-hero">
        <div className="hero-copy">
          <p className="eyebrow">PLATFORM ADMIN</p>
          <h1>Global provider setup</h1>
          <p className="muted large">
            Configure each provider once for AI Marketing OS. Clients then connect their own accounts through OAuth, while every token stays encrypted and isolated inside that client's workspace.
          </p>
        </div>
        <div className="hero-badges">
          <span className={"pill " + (data.summary.runtimeReady ? "accent" : "")}>
            {data.summary.readyChecks}/{data.summary.totalChecks} runtime checks
          </span>
          <span className="pill">{data.summary.readyProviders}/{data.summary.totalProviders} providers ready</span>
        </div>
      </div>

      <div className="platform-model card">
        <div>
          <span className="platform-step">01</span>
          <strong>One central provider app</strong>
          <p>AI Marketing OS owns one Meta, Google, TikTok, X, LinkedIn and Pinterest developer configuration.</p>
        </div>
        <div>
          <span className="platform-step">02</span>
          <strong>Client authorizes their account</strong>
          <p>The client only sees Connect, provider login and permission approval. They never handle App IDs or secrets.</p>
        </div>
        <div>
          <span className="platform-step">03</span>
          <strong>Workspace-isolated tokens</strong>
          <p>OAuth state is bound to the active workspace and tokens are encrypted before database storage.</p>
        </div>
      </div>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">PRODUCTION FOUNDATION</p><h2>Runtime & security readiness</h2></div>
          <span className={"health " + (data.summary.runtimeReady ? "healthy" : "needs_action")}>
            {data.summary.runtimeReady ? "Production ready" : data.summary.blockers + " setup items"}
          </span>
        </div>
        {data.stripe.deferred && <div className="profile-notice">Payment gateway setup is intentionally deferred. Plans, usage and entitlements remain available without blocking core SaaS production readiness.</div>}

        {!data.stripe.deferred && <div className="platform-check-grid">
          {data.checks.map((check) => (
            <article className="card platform-check" key={check.key}>
              <div className="platform-check-head">
                <span className={"platform-status-dot " + (check.ready ? "ready" : "missing")} />
                <strong>{check.label}</strong>
                <span className={"health " + (check.ready ? "healthy" : "needs_action")}>{stateLabel(check.ready)}</span>
              </div>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>}
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">PAYMENTS</p><h2>Payment gateway readiness</h2></div>
          <span className={data.stripe.deferred ? "pill" : "health " + (data.stripe.ready ? "healthy" : "needs_action")}>
            {data.stripe.deferred ? "Deferred" : data.stripe.ready ? "Live payments ready" : "Setup required"}
          </span>
        </div>

        <div className="platform-check-grid">
          <article className="card platform-check">
            <div className="platform-check-head">
              <span className={"platform-status-dot " + (data.stripe.accountReady ? "ready" : "missing")} />
              <strong>Stripe account</strong>
              <span className={"health " + (data.stripe.accountReady ? "healthy" : "needs_action")}>{data.stripe.accountReady ? "Verified" : "Needs action"}</span>
            </div>
            <p>{data.stripe.accountDetail}</p>
          </article>
          <article className="card platform-check">
            <div className="platform-check-head">
              <span className={"platform-status-dot " + (data.stripe.modeReady ? "ready" : "missing")} />
              <strong>Payment mode</strong>
              <span className={"health " + (data.stripe.modeReady ? "healthy" : "needs_action")}>{data.stripe.mode}</span>
            </div>
            <p>Production should use Stripe live-mode credentials. Test-mode credentials remain useful only for non-production validation.</p>
          </article>
          <article className="card platform-check">
            <div className="platform-check-head">
              <span className={"platform-status-dot " + (data.stripe.webhookReady ? "ready" : "missing")} />
              <strong>Webhook signing</strong>
              <span className={"health " + (data.stripe.webhookReady ? "healthy" : "needs_action")}>{data.stripe.webhookReady ? "Configured" : "Missing"}</span>
            </div>
            <p>Signed Stripe lifecycle events keep subscription state synchronized and idempotent.</p>
          </article>
        </div>}

        {!data.stripe.deferred && <div className="billing-plan-grid">
          {data.stripe.prices.map((price) => (
            <article className={"card billing-plan " + (price.ready ? "active" : "")} key={price.planKey}>
              <div className="billing-plan-head">
                <div><p className="eyebrow">{price.planKey.toUpperCase()}</p><h3>{price.planName}</h3></div>
                <span className={"health " + (price.ready ? "healthy" : "needs_action")}>{price.ready ? "Verified" : "Needs setup"}</span>
              </div>
              <p className="muted">{price.detail}</p>
              <div className="billing-limit-grid">
                <div><span>Reachable</span><strong>{price.reachable ? "Yes" : "No"}</strong></div>
                <div><span>Currency</span><strong>{price.currency || "—"}</strong></div>
                <div><span>Interval</span><strong>{price.recurringInterval || "—"}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <div><p className="eyebrow">CENTRAL OAUTH APPS</p><h2>Social provider readiness</h2></div>
          <span className="pill">Secrets never displayed</span>
        </div>

        <div className="platform-provider-grid">
          {data.providers.map((provider) => (
            <article className="card platform-provider-card" key={provider.id}>
              <div className="platform-provider-head">
                <div className="platform-provider-identity">
                  <span className="platform-provider-mark">{provider.short}</span>
                  <div><span className="platform-provider-label">CENTRAL APP</span><h3>{provider.name}</h3></div>
                </div>
                <span className={"health " + (provider.ready ? "healthy" : "needs_action")}>{stateLabel(provider.ready)}</span>
              </div>

              <div className="platform-readiness-row">
                <div><span>App credentials</span><strong>{provider.appConfigured ? "Configured" : "Missing"}</strong></div>
                <div><span>Secure storage</span><strong>{provider.storageReady ? "Ready" : "Not ready"}</strong></div>
              </div>

              <div className="platform-field">
                <span>Production callback</span>
                <code>{provider.callbackUrl}</code>
              </div>

              <div className="platform-field">
                <span>Platform-only configuration keys</span>
                <div className="platform-chip-row">
                  {provider.credentials.map((item) => <code key={item}>{item}</code>)}
                </div>
              </div>

              <div className="platform-field">
                <span>OAuth scopes used by the portal</span>
                <div className="platform-chip-row">
                  {provider.scopes.map((item) => <span className="pill" key={item}>{item}</span>)}
                </div>
              </div>

              <div className="platform-capabilities">
                {provider.capabilities.map((item) => <span key={item}>✓ {item}</span>)}
              </div>
              <p className="platform-provider-note">{provider.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card platform-safety-card">
        <div><p className="eyebrow">CLIENT EXPERIENCE</p><h2>No developer setup for clients</h2></div>
        <p>Once a central provider card is Ready, every client workspace can use Social Hub → Connect. Provider credentials remain platform-only and are never shown in client UI.</p>
        <a className="btn secondary" href="/clients">Open agency clients</a>
      </section>
    </div>
  );
}
