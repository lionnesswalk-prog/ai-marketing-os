import { canManageMarketing, requireSession } from "../../lib/auth";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { BrandStudio } from "../../components/BrandStudio";
import { BrandCopilot } from "../../components/BrandCopilot";
import { listBrandCopilotHistory } from "../../lib/brand-copilot-history";
import { listBrandAssets } from "../../lib/brand-assets";
import { getLatestContentCalendarPlan } from "../../lib/content-calendar";
import { ContentCalendar } from "../../components/ContentCalendar";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = await requireSession();
  const [profile, copilotHistory, brandAssets, latestCalendar] = await Promise.all([
    getCurrentBrandProfile(session),
    listBrandCopilotHistory(session, 40).catch(() => []),
    listBrandAssets(session, 12).catch(() => []),
    getLatestContentCalendarPlan(session).catch(() => null),
  ]);

  return (
    <div className="studio-page">
      <div className="dashboard-hero studio-hero">
        <div className="hero-copy">
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Create, ask, schedule, publish.</h1>
          <p className="muted large">Generate logo-led branded social creatives, let AI recommend a posting window, publish or schedule from the same workspace, and talk directly to an AI copilot grounded in {profile.name}&apos;s Brand Profile and Knowledge Base.</p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">{profile.name}</span>
          <span className="pill">Human-controlled automation</span>
        </div>
      </div>

      <BrandStudio
        brandName={profile.name}
        logoReady={Boolean(profile.logoUrl)}
        canGenerate={canManageMarketing(session.role)}
        initialAssets={brandAssets}
      />

      <ContentCalendar
        initialPlan={latestCalendar}
        canManage={canManageMarketing(session.role)}
      />

      <BrandCopilot brandName={profile.name} initialMessages={copilotHistory.map((item) => ({ role: item.role, content: item.content }))} />
    </div>
  );
}
