import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { getPlatformReadiness } from "../../lib/platform-readiness";

function stateLabel(ready: boolean) {
  return ready ? "Ready" : "Needs setup";
}

export default async function PlatformPage() {
  const session = await requireSession();
  if (!session.platformAdmin) redirect("/dashboard");

  const data = getPlatformReadiness();

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

        <div className="platform-check-grid">
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
