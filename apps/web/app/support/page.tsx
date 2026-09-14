export default function SupportPage() {
  const support = process.env.SUPPORT_EMAIL || "";
  return (
    <div>
      <p className="eyebrow">AI MARKETING OS</p>
      <h1>Support</h1>
      <p className="muted large">Free beta support for account access, data requests and product issues.</p>
      <section className="card">
        <h2>Contact</h2>
        {support ? <p>Email: <a href={"mailto:" + support}>{support}</a></p> : <div className="profile-notice">Support email has not been configured by the platform operator yet.</div>}
        <h2>When reporting a problem</h2>
        <p>Include the page you were using, what you expected, what happened, approximate time and a screenshot if possible. Never send passwords, OAuth secrets or API keys.</p>
        <h2>Account recovery</h2>
        <p>Use <a href="/forgot-password">Forgot password</a> for password recovery. Data deletion instructions are available on the <a href="/data-deletion">Data deletion</a> page.</p>
      </section>
    </div>
  );
}
