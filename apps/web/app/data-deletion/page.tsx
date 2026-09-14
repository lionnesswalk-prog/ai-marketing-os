export default function DataDeletionPage() {
  const support = process.env.SUPPORT_EMAIL || "Support email pending configuration";
  return (
    <div>
      <p className="eyebrow">AI MARKETING OS</p>
      <h1>Data deletion</h1>
      <p className="muted large">Self-service deletion is available from your account profile.</p>
      <section className="card">
        <h2>Delete from the product</h2>
        <p>Sign in, open Profile, scroll to Data & Account, type DELETE and confirm. Your user account is removed. If you are the only member of a workspace, that workspace and its associated brand data are also deleted. If other members remain, the shared workspace stays active and only your access is removed.</p>
        <h2>Connected social accounts</h2>
        <p>You can disconnect supported social providers from Social Hub before deleting your account. Workspace deletion removes the encrypted integration records stored by AI Marketing OS.</p>
        <h2>Unable to sign in?</h2>
        <p>Use Forgot password first. If you still cannot access the account, contact {support} with the account email and a clear deletion request. Identity verification may be required before a manual deletion request is processed.</p>
      </section>
      <p><a className="text-link" href="/privacy">Privacy Policy</a> · <a className="text-link" href="/support">Support</a></p>
    </div>
  );
}
