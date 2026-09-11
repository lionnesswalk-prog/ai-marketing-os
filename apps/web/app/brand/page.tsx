import { canManageMarketing, requireSession } from "../../lib/auth";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { BrandProfileEditor } from "../../components/BrandProfileEditor";

export default async function BrandPage() {
  const session = await requireSession();
  const profile = await getCurrentBrandProfile(session);

  return (
    <div className="brand-profile-page">
      <div className="dashboard-hero brand-profile-hero">
        <div className="hero-copy">
          <p className="eyebrow">BRAND INTELLIGENCE</p>
          <h1>{profile.name}</h1>
          <p className="muted large">Define the trusted context AI Marketing OS should use whenever it plans strategy, creates content or drafts customer replies for this workspace.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">Workspace scoped</span>
          <span className="pill">AI context source</span>
        </div>
      </div>

      <BrandProfileEditor initialProfile={profile} canEdit={canManageMarketing(session.role)} />
    </div>
  );
}
