import { requireSession } from "../../lib/auth";
import { StrategyBuilder } from "../../components/StrategyBuilder";

export default async function Strategy() {
  await requireSession();
  return (
    <div>
      <p className="eyebrow">AI STRATEGIST</p>
      <h1>Build a measurable campaign plan</h1>
      <p className="muted large">Turn a budget and business objective into a channel mix, creative thesis, test plan and KPI framework.</p>
      <StrategyBuilder />
    </div>
  );
}
