export default function TermsPage() {
  const support = process.env.SUPPORT_EMAIL || "Support email pending configuration";
  return (
    <div>
      <p className="eyebrow">AI MARKETING OS</p>
      <h1>Terms of Use</h1>
      <p className="muted large">Last updated: 14 September 2026 · Free beta</p>
      <section className="card">
        <h2>Free beta service</h2>
        <p>AI Marketing OS is currently offered as a free beta. Features, limits and availability may change as the product evolves. No payment is required unless paid plans are introduced and explicitly accepted in the future.</p>
        <h2>Your account and data</h2>
        <p>You are responsible for accurate account information, protecting your credentials and having the right to upload or connect the data, brands and third-party accounts you use with the service.</p>
        <h2>AI assistance</h2>
        <p>AI-generated strategy, content and recommendations are decision-support tools, not guarantees of business results. Review important outputs before use. Financial, legal, medical, regulated advertising and other high-impact claims require appropriate human review and verified source data.</p>
        <h2>Marketing and platform rules</h2>
        <p>You are responsible for complying with advertising laws, platform policies, intellectual-property rights, consent requirements and customer communication rules that apply to your business and market.</p>
        <h2>Connected services</h2>
        <p>Third-party services may change APIs, permissions or availability. AI Marketing OS cannot guarantee uninterrupted access to an external provider and may disable an integration if required for security or policy compliance.</p>
        <h2>Acceptable use</h2>
        <p>Do not use the service for unlawful activity, deceptive impersonation, unauthorized access, spam, malware, infringement, fraudulent advertising or attempts to bypass workspace or security controls.</p>
        <h2>Service availability</h2>
        <p>The beta is provided on an as-available basis. We aim for reliable operation but do not promise uninterrupted or error-free service. Material automation that changes spend remains subject to the product's approval controls where implemented.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: {support}</p>
      </section>
      <p><a className="text-link" href="/privacy">Privacy Policy</a> · <a className="text-link" href="/data-deletion">Data deletion</a></p>
    </div>
  );
}
