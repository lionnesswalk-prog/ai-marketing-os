import { canManageMarketing, requireSession } from "../../lib/auth";
import { getCurrentBrandProfile } from "../../lib/brand-profile";
import { StrategyBuilder } from "../../components/StrategyBuilder";

export default async function Strategy() {
  const session = await requireSession();
  const profile = await getCurrentBrandProfile(session);

  return (
    <div>
      <p className="eyebrow">AI STRATEGIST</p>
      <h1>Build a measurable campaign plan</h1>
      <p className="muted large">
        Turn a budget and business objective into a channel mix, creative thesis, test plan and KPI framework for {profile.name}.
      </p>
      <StrategyBuilder brandName={profile.name} disabled={!canManageMarketing(session.role)} />
    </div>
  );
}
