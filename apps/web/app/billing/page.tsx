import { requireSession } from "../../lib/auth";
import { BillingActions } from "../../components/BillingActions";
import { billingEntitlementsEnforced, billingLimitsEnforced, getBillingPlans, getBillingSetupState, getWorkspaceBilling, shouldManageSubscriptionInPortal } from "../../lib/billing";
import { getBillingAuditEvents } from "../../lib/audit";

function limit(value?:number){return value?String(value):"Not enforced";}
function notice(status?:string){
  if(status==="success") return {tone:"success",text:"Checkout completed. Stripe webhook confirmation updates the workspace subscription automatically."};
  if(status==="cancelled") return {tone:"error",text:"Checkout was cancelled. No billing change was applied."};
  return null;
}

function subscriptionNotice(status?:string){
  if(status==="past_due") return {tone:"error",text:"Payment is past due. Open Stripe billing to update the payment method and restore normal billing state."};
  if(status==="unpaid") return {tone:"error",text:"Subscription is unpaid. Billing must be resolved in Stripe before relying on paid-plan access."};
  if(status==="incomplete") return {tone:"error",text:"Subscription setup is incomplete. Finish the payment flow in Stripe."};
  if(status==="paused") return {tone:"error",text:"Subscription is paused in Stripe. Review the billing portal before continuing paid-plan operations."};
  if(status==="canceled") return {tone:"error",text:"Subscription is canceled. Choose a plan to start a new subscription when needed."};
  return null;
}

export default async function BillingPage({searchParams}:{searchParams?:Promise<{status?:string}>}){
  const session=await requireSession();
  const [billing,auditEvents]=await Promise.all([
    getWorkspaceBilling(session),
    getBillingAuditEvents(session,12),
  ]);
  const plans=getBillingPlans();
  const setup=getBillingSetupState();
  const params=searchParams?await searchParams:undefined;
  const message=notice(params?.status);
  const billingStateNotice=subscriptionNotice(billing.subscription?.status);
  const currentPlan=billing.subscription?.planKey;
  const canManage=session.role==="admin";
  const limitsEnforced=billingLimitsEnforced();
  const entitlementsEnforced=billingEntitlementsEnforced();
  const manageExistingSubscription=shouldManageSubscriptionInPortal(
    billing.subscription?.status,
    billing.subscription?.subscriptionId,
  );

  return <div className="billing-page">
    <div className="dashboard-hero billing-hero">
      <div className="hero-copy">
        <p className="eyebrow">WORKSPACE BILLING</p>
        <h1>Subscription & usage</h1>
        <p className="muted large">Stripe-hosted checkout keeps payment data outside AI Marketing OS. The portal stores only billing identifiers and subscription state.</p>
      </div>
      <div className="hero-badges">
        <span className={"pill "+((billing.subscription?.status==="active"||billing.subscription?.status==="trialing")?"accent":"")}>{billing.subscription?.status||"No paid plan"}</span>
        <span className="pill">{canManage?"Admin billing access":"Read only"}</span>
      </div>
    </div>

    {message&&<div className={"profile-notice "+message.tone}>{message.text}</div>}
    {billingStateNotice&&<div className={"profile-notice "+billingStateNotice.tone}>{billingStateNotice.text}</div>}
    {!setup.webhookConfigured&&<div className="profile-notice error">Stripe webhook secret is not configured yet. Automatic subscription synchronization is not production-ready.</div>}

    <section>
      <div className="section-head">
        <div><p className="eyebrow">CURRENT WORKSPACE</p><h2>Usage this month</h2></div>
        {billing.subscription?.customerId&&<BillingActions planKey={currentPlan||"starter"} checkoutEnabled={billing.configured} canManage={canManage} showPortal />}
      </div>
      <div className="billing-usage-grid">
        <article className="card billing-usage"><span>Members</span><strong>{billing.usage.members}</strong><small>Workspace access seats</small></article>
        <article className="card billing-usage"><span>Social connections</span><strong>{billing.usage.socialConnections}</strong><small>Connected provider accounts</small></article>
        <article className="card billing-usage"><span>Social posts</span><strong>{billing.usage.socialPostsThisMonth}</strong><small>Created this calendar month</small></article>
      </div>
      {billing.subscription&&<div className="card billing-current">
        <div><span>Current plan</span><strong>{plans.find((plan)=>plan.key===billing.subscription?.planKey)?.name||billing.subscription.planKey}</strong></div>
        <div><span>Status</span><strong>{billing.subscription.status}</strong></div>
        <div><span>Renews / ends</span><strong>{billing.subscription.currentPeriodEnd?new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-IN"):"Pending Stripe sync"}</strong></div>
        <div><span>Cancellation</span><strong>{billing.subscription.cancelAtPeriodEnd?"Cancels at period end":"Not scheduled"}</strong></div>
      </div>}
    </section>

    <section>
      <div className="section-head"><div><p className="eyebrow">PLANS</p><h2>Choose workspace capacity</h2></div><div className="meta-row"><span className={limitsEnforced ? "pill accent" : "pill"}>{limitsEnforced ? "Plan limits enforced" : "Limits informational · enforcement off"}</span><span className={entitlementsEnforced ? "pill accent" : "pill"}>{entitlementsEnforced ? "Feature entitlements enforced" : "Entitlements informational · enforcement off"}</span></div></div>
      <div className="billing-plan-grid">
        {plans.map((plan)=>{
          const active=currentPlan===plan.key&&Boolean(billing.subscription);
          return <article className={"card billing-plan "+(active?"active":"")} key={plan.key}>
            <div className="billing-plan-head"><div><p className="eyebrow">{plan.key.toUpperCase()}</p><h3>{plan.name}</h3></div>{active&&<span className="pill accent">Current</span>}</div>
            <div className="billing-price">{plan.displayPrice}</div>
            <p className="muted">{plan.description}</p>
            <div className="billing-limit-grid">
              <div><span>Members</span><strong>{limit(plan.limits.members)}</strong></div>
              <div><span>Connections</span><strong>{limit(plan.limits.socialConnections)}</strong></div>
              <div><span>Posts / month</span><strong>{limit(plan.limits.socialPostsMonthly)}</strong></div>
            </div>
            <div className="billing-features">{plan.features.map((feature)=><span key={feature}>✓ {feature}</span>)}</div>
            {!active&&<BillingActions
              planKey={plan.key}
              checkoutEnabled={Boolean(plan.priceId&&setup.checkoutConfigured&&!manageExistingSubscription)}
              canManage={canManage}
              showPortal={manageExistingSubscription&&Boolean(billing.subscription?.customerId)}
              portalLabel="Change plan in Stripe"
            />}
          </article>;
        })}
      </div>
    </section>

    <section>
      <div className="section-head">
        <div><p className="eyebrow">BILLING AUDIT</p><h2>Recent subscription activity</h2></div>
        <span className="pill">{auditEvents.length} events</span>
      </div>
      {auditEvents.length ? (
        <div className="security-audit-list">
          {auditEvents.map((event)=>(
            <article className="card security-event" key={event.id}>
              <div className="security-event-main">
                <span className={"severity "+event.severity}>{event.severity}</span>
                <div>
                  <h3>{event.label}</h3>
                  <p>{event.detail}</p>
                  <div className="security-event-meta">
                    <span>{event.actor || event.actorType.replaceAll("_"," ")}</span>
                    <span>{event.entityType}</span>
                  </div>
                </div>
              </div>
              <div className="security-event-time">
                <strong>{new Date(event.createdAt).toLocaleString("en-IN")}</strong>
                <span>{event.brandName}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty"><h3>No billing events yet</h3><p className="muted">Checkout, portal and Stripe subscription synchronization events will appear here.</p></div>
      )}
    </section>

    {!canManage&&<div className="card billing-readonly"><strong>Billing is read-only for your role.</strong><p>Ask a workspace Admin to start, change or manage the subscription.</p></div>}
  </div>;
}
