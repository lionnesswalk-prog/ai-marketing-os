import { requireSession } from "../../lib/auth";
import { ApprovalQueue } from "../../components/ApprovalQueue";
import { listApprovals } from "../../lib/repository";

export default async function ApprovalsPage() {
  await requireSession();
  const approvals = await listApprovals();
  return (
    <div>
      <p className="eyebrow">HUMAN CONTROL</p>
      <h1>Approval queue</h1>
      <p className="muted large">Budget changes and other risky actions stop here until an authorized person approves them.</p>
      <ApprovalQueue initial={approvals} />
    </div>
  );
}
