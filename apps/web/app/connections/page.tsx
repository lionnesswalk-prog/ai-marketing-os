import { canManageIntegrations, requireSession } from "../../lib/auth";
import { getSocialPlatforms } from "../../lib/social-platforms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Social Connections | AI Marketing OS",
  description: "Connect and manage social accounts for the active client workspace.",
};

export default async function ConnectionsPage() {
  const session = await requireSession();
  const canManage = canManageIntegrations(session.role);
  const platforms = await getSocialPlatforms();
  const connectedCount = platforms.filter((platform) => platform.connected).length;
  const readyCount = platforms.filter((platform) => platform.setupReady !== false).length;
  const healthIssues = platforms.filter((platform) => platform.connectionCheckFailed).length;

  return (
    <div className="social-page">
      <div className="dashboard-hero social-hero">
        <div className="hero-copy">
          <p className="eyebrow">SOCIAL CONNECTIONS</p>
          <h1>Connect every client channel from one place.</h1>
          <p className="muted large">
            Choose Connect, sign in to the social network, and approve access. Platform credentials stay central while every account and token remains isolated to the active workspace.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{connectedCount}/{platforms.length} connected</span>
          <span className="pill">{readyCount}/{platforms.length} providers ready</span>
          <a className="pill dashboard-badge-link" href="/social">Back to Social Hub</a>
          {session.platformAdmin && <a className="pill dashboard-badge-link" href="/platform#meta-settings">Meta app settings</a>}
        </div>
      </div>

      {healthIssues > 0 && (
        <div className="profile-notice social-notice error">
          {healthIssues} connection {healthIssues === 1 ? "check needs" : "checks need"} attention. Reconnect the affected account or ask the platform administrator to verify provider setup.
        </div>
      )}

      {!canManage && (
        <div className="profile-notice social-notice">
          Read-only social access · ask a workspace admin or marketing manager to connect or disconnect accounts.
        </div>
      )}

      <section className="card">
        <div className="social-section-head">
          <div>
            <p className="eyebrow">ACTIVE WORKSPACE</p>
            <h2>Social accounts</h2>
            <p className="muted">
              Connections made here belong only to this workspace. Switching clients shows that client&apos;s own accounts.
            </p>
          </div>
          <span className={"health " + (connectedCount === platforms.length ? "healthy" : connectedCount > 0 ? "watch" : "needs_action")}>
            {connectedCount === platforms.length ? "All connected" : connectedCount > 0 ? "Partially connected" : "Action needed"}
          </span>
        </div>

        <div className="social-platform-grid">
          {platforms.map((platform) => {
            const setupReady = platform.setupReady !== false;

            return (
              <article className={"social-platform " + (platform.connected ? "connected" : "")} key={platform.id}>
                <div className="social-platform-mark">{platform.short}</div>
                <div className="social-platform-copy">
                  <strong>{platform.name}</strong>
                  <span>
                    {platform.connectionCheckFailed
                      ? "Connection status unavailable"
                      : platform.connected
                        ? (platform.accountLabel || "API connected")
                        : setupReady
                          ? "Ready to connect"
                          : "Platform setup pending"}
                  </span>
                </div>
                <div className="social-platform-actions">
                  {platform.connected && <span className="pill accent">Connected</span>}
                  {!platform.connected && setupReady && <span className="pill">Not connected</span>}

                  {canManage && !platform.connected && platform.connectUrl && setupReady && (
                    <a className="connect-social" href={platform.connectUrl}>Connect</a>
                  )}

                  {canManage && !platform.connected && !setupReady && (
                    session.platformAdmin
                      ? <a className="connect-social" href={platform.id === "facebook" || platform.id === "instagram" ? "/platform#meta-settings" : "/platform"}>Finish setup</a>
                      : <span className="pill" title="The platform administrator must finish the central provider setup.">Setup pending</span>
                  )}

                  {canManage && platform.connected && platform.disconnectUrl && (
                    <form action={platform.disconnectUrl} method="post">
                      <button type="submit">Disconnect</button>
                    </form>
                  )}

                  <a href={platform.homeUrl} target="_blank" rel="noreferrer">
                    Open account ↗
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <p className="social-help">
          Meta connects Facebook Pages and linked Instagram professional accounts through one authorization. LinkedIn, X, TikTok, YouTube and Pinterest use their own secure OAuth flow. Clients never enter App IDs, secrets or Vercel settings.
        </p>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>Three simple steps</h2>
          </div>
        </div>
        <div className="metric-grid">
          <article className="card metric-card">
            <div className="metric-kicker"><span className="eyebrow">01 · CHOOSE</span><span className="metric-orb" /></div>
            <h3>Select Connect</h3>
            <p className="muted">Start from the provider card for the active client workspace.</p>
          </article>
          <article className="card metric-card">
            <div className="metric-kicker"><span className="eyebrow">02 · AUTHORIZE</span><span className="metric-orb" /></div>
            <h3>Approve access</h3>
            <p className="muted">Sign in on the provider&apos;s own secure authorization screen.</p>
          </article>
          <article className="card metric-card">
            <div className="metric-kicker"><span className="eyebrow">03 · PUBLISH</span><span className="metric-orb" /></div>
            <h3>Return to Social Hub</h3>
            <p className="muted">Create, schedule and publish using the connected channel.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
