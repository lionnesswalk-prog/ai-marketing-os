export default function PrivacyPage() {
  const support = process.env.SUPPORT_EMAIL || "Support email pending configuration";
  return (
    <div>
      <p className="eyebrow">AI MARKETING OS</p>
      <h1>Privacy Policy</h1>
      <p className="muted large">Last updated: 14 September 2026</p>
      <section className="card">
        <h2>What we collect</h2>
        <p>AI Marketing OS stores account details, workspace and brand information, content you submit, campaign and lead data you enter or connect, social integration metadata, audit records and technical security logs needed to operate the service.</p>
        <h2>How data is used</h2>
        <p>Data is used to provide workspace features, generate marketing assistance, secure accounts, operate connected integrations, diagnose errors and improve the reliability of the service. Workspace data is scoped to the active workspace and is not intentionally shared with other customer workspaces.</p>
        <h2>AI processing</h2>
        <p>When live AI is enabled, relevant workspace context may be sent to the configured AI provider to generate requested strategy, content or inquiry assistance. The product is designed to distinguish verified workspace facts from assumptions and reference notes.</p>
        <h2>Connected platforms</h2>
        <p>If you connect a third-party account such as Meta, LinkedIn, X, TikTok, YouTube or Pinterest, authorization tokens and account metadata are stored only as needed to provide the requested integration. Tokens are encrypted before database storage when production integration storage is enabled.</p>
        <h2>Retention and deletion</h2>
        <p>You can delete your account from Profile. If you are the only member of a workspace, owned workspace data is deleted with the account. Shared workspaces remain and your access is removed. Some security or operational records may be retained where required for fraud prevention, legal obligations or incident investigation.</p>
        <h2>Security</h2>
        <p>Production mode uses signed sessions, password hashing, workspace access controls, encrypted integration secrets, authentication throttling and audit logging. No online service can guarantee absolute security.</p>
        <h2>Contact</h2>
        <p>Privacy and data requests: {support}</p>
      </section>
      <p><a className="text-link" href="/terms">Terms of Use</a> · <a className="text-link" href="/data-deletion">Data deletion</a> · <a className="text-link" href="/support">Support</a></p>
    </div>
  );
}
