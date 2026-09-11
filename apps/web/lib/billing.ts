import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppSession } from "./auth";
import { getPrisma } from "./prisma";
import { recordAuditEvent } from "./audit";

export type BillingPlanKey = "starter" | "growth" | "scale";

export type BillingFeatureKey =
  | "aiStrategy"
  | "socialPublishing"
  | "leadWorkspace"
  | "coreAnalytics"
  | "campaignDrafts"
  | "advancedWorkflows"
  | "priorityOperations"
  | "agencyScale";

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  description: string;
  displayPrice: string;
  priceId?: string;
  monthlyAmountInr?: number;
  features: string[];
  entitlements: BillingFeatureKey[];
  limits: {
    members?: number;
    socialConnections?: number;
    socialPostsMonthly?: number;
  };
};

function usePostgres() {
  return process.env.DATA_BACKEND === "postgres";
}

function positiveInt(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveMoney(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function planKey(value: string | undefined): BillingPlanKey {
  return value === "growth" || value === "scale" ? value : "starter";
}

export function getBillingPlans(): BillingPlan[] {
  return [
    {
      key: "starter",
      name: "Starter",
      description: "Core workspace operations for a growing brand.",
      displayPrice: process.env.BILLING_STARTER_DISPLAY_PRICE || "Pricing not configured",
      priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY || undefined,
      monthlyAmountInr: positiveMoney(process.env.BILLING_STARTER_MONTHLY_AMOUNT_INR),
      features: ["AI strategy", "Social publishing", "Lead workspace", "Core analytics"],
      entitlements: ["aiStrategy", "socialPublishing", "leadWorkspace", "coreAnalytics"],
      limits: {
        members: positiveInt(process.env.BILLING_STARTER_MEMBER_LIMIT),
        socialConnections: positiveInt(process.env.BILLING_STARTER_SOCIAL_CONNECTION_LIMIT),
        socialPostsMonthly: positiveInt(process.env.BILLING_STARTER_SOCIAL_POST_LIMIT_MONTHLY),
      },
    },
    {
      key: "growth",
      name: "Growth",
      description: "More team capacity and automation for active brands.",
      displayPrice: process.env.BILLING_GROWTH_DISPLAY_PRICE || "Pricing not configured",
      priceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY || undefined,
      monthlyAmountInr: positiveMoney(process.env.BILLING_GROWTH_MONTHLY_AMOUNT_INR),
      features: ["Everything in Starter", "Expanded team access", "Campaign drafts", "Advanced workflows"],
      entitlements: ["aiStrategy", "socialPublishing", "leadWorkspace", "coreAnalytics", "campaignDrafts", "advancedWorkflows"],
      limits: {
        members: positiveInt(process.env.BILLING_GROWTH_MEMBER_LIMIT),
        socialConnections: positiveInt(process.env.BILLING_GROWTH_SOCIAL_CONNECTION_LIMIT),
        socialPostsMonthly: positiveInt(process.env.BILLING_GROWTH_SOCIAL_POST_LIMIT_MONTHLY),
      },
    },
    {
      key: "scale",
      name: "Scale",
      description: "Agency-grade capacity for high-volume workspaces.",
      displayPrice: process.env.BILLING_SCALE_DISPLAY_PRICE || "Pricing not configured",
      priceId: process.env.STRIPE_PRICE_SCALE_MONTHLY || undefined,
      monthlyAmountInr: positiveMoney(process.env.BILLING_SCALE_MONTHLY_AMOUNT_INR),
      features: ["Everything in Growth", "Scale-ready limits", "Priority operations", "Agency-scale controls"],
      entitlements: ["aiStrategy", "socialPublishing", "leadWorkspace", "coreAnalytics", "campaignDrafts", "advancedWorkflows", "priorityOperations", "agencyScale"],
      limits: {
        members: positiveInt(process.env.BILLING_SCALE_MEMBER_LIMIT),
        socialConnections: positiveInt(process.env.BILLING_SCALE_SOCIAL_CONNECTION_LIMIT),
        socialPostsMonthly: positiveInt(process.env.BILLING_SCALE_SOCIAL_POST_LIMIT_MONTHLY),
      },
    },
  ];
}


export function billingLimitsEnforced() {
  return process.env.BILLING_ENFORCE_LIMITS === "true";
}

export function billingEntitlementsEnforced() {
  return process.env.BILLING_ENFORCE_ENTITLEMENTS === "true";
}

async function planForWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const subscription = await prisma.workspaceSubscription.findUnique({
    where: { workspaceId },
    select: { planKey: true },
  });
  const selected = planKey(subscription?.planKey);
  return getBillingPlans().find((item) => item.key === selected) || getBillingPlans()[0];
}

export async function workspaceHasBillingFeature(workspaceId: string, feature: BillingFeatureKey) {
  if (!usePostgres()) return true;
  const plan = await planForWorkspace(workspaceId);
  return plan.entitlements.includes(feature);
}

export async function assertBillingFeature(workspaceId: string, feature: BillingFeatureKey) {
  if (!billingEntitlementsEnforced() || !usePostgres()) return;
  if (!(await workspaceHasBillingFeature(workspaceId, feature))) {
    throw new Error("BILLING_FEATURE_NOT_ENTITLED");
  }
}

export async function assertBillingMemberCapacity(workspaceId: string, additional = 1) {
  if (!billingLimitsEnforced() || !usePostgres()) return;
  const plan = await planForWorkspace(workspaceId);
  const limit = plan.limits.members;
  if (!limit) return;

  const prisma = getPrisma();
  const [members, invites] = await Promise.all([
    prisma.workspaceAccess.count({ where: { workspaceId } }),
    prisma.workspaceInvite.count({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  if (members + invites + additional > limit) {
    throw new Error("BILLING_MEMBER_LIMIT");
  }
}

export async function assertBillingSocialPostCapacity(workspaceId: string, additional = 1) {
  if (!billingLimitsEnforced() || !usePostgres()) return;
  const plan = await planForWorkspace(workspaceId);
  const limit = plan.limits.socialPostsMonthly;
  if (!limit) return;

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const count = await getPrisma().socialPost.count({
    where: {
      brand: { workspaceId },
      createdAt: { gte: start },
    },
  });

  if (count + additional > limit) {
    throw new Error("BILLING_SOCIAL_POST_LIMIT");
  }
}

export async function assertBillingConnectionCapacity(workspaceId: string, provider: string) {
  if (!billingLimitsEnforced() || !usePostgres()) return;
  const plan = await planForWorkspace(workspaceId);
  const limit = plan.limits.socialConnections;
  if (!limit) return;

  const prisma = getPrisma();
  const brand = await prisma.brand.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!brand) return;

  const existing = await prisma.integrationConnection.findUnique({
    where: { brandId_provider: { brandId: brand.id, provider } },
    select: { status: true },
  });
  if (existing?.status === "connected") return;

  const count = await prisma.integrationConnection.count({
    where: {
      status: "connected",
      brand: { workspaceId },
    },
  });

  if (count + 1 > limit) {
    throw new Error("BILLING_CONNECTION_LIMIT");
  }
}

export function getBillingSetupState() {
  const plans=getBillingPlans();
  const configuredPlans=plans.filter((item)=>Boolean(item.priceId)).map((item)=>item.key);
  return {
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    checkoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY && configuredPlans.length > 0),
    portalConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    configuredPlans,
    configuredPlanCount: configuredPlans.length,
    totalPlans: plans.length,
    allPlanPricesConfigured: configuredPlans.length === plans.length,
  };
}

export function shouldManageSubscriptionInPortal(status:string|undefined, subscriptionId?:string) {
  if(!subscriptionId) return false;
  return status !== "canceled" && status !== "incomplete_expired";
}

export async function getAgencyBillingOverview(session:AppSession) {
  if(!session.platformAdmin) throw new Error("PLATFORM_ADMIN_REQUIRED");
  if(!usePostgres()) {
    return {
      totalWorkspaces:1,
      subscribedWorkspaces:0,
      active:0,
      trialing:0,
      pastDue:0,
      canceled:0,
      noSubscription:1,
      byPlan:{starter:0,growth:0,scale:0} as Record<BillingPlanKey,number>,
      mrrInr:undefined as number|undefined,
      revenueConfigured:false,
    };
  }

  const prisma=getPrisma();
  const [totalWorkspaces,subscriptions]=await Promise.all([
    prisma.workspace.count(),
    prisma.workspaceSubscription.findMany({
      select:{planKey:true,status:true},
    }),
  ]);

  const byPlan:Record<BillingPlanKey,number>={starter:0,growth:0,scale:0};
  for(const subscription of subscriptions) byPlan[planKey(subscription.planKey)] += 1;

  const recurring=subscriptions.filter((item)=>item.status==="active"||item.status==="trialing");
  const plans=new Map(getBillingPlans().map((plan)=>[plan.key,plan] as const));
  const revenueConfigured=recurring.length>0 && recurring.every((item)=>plans.get(planKey(item.planKey))?.monthlyAmountInr !== undefined);
  const mrrInr=revenueConfigured
    ? recurring.reduce((total,item)=>total+(plans.get(planKey(item.planKey))?.monthlyAmountInr||0),0)
    : undefined;

  return {
    totalWorkspaces,
    subscribedWorkspaces:subscriptions.length,
    active:subscriptions.filter((item)=>item.status==="active").length,
    trialing:subscriptions.filter((item)=>item.status==="trialing").length,
    pastDue:subscriptions.filter((item)=>item.status==="past_due"||item.status==="unpaid").length,
    canceled:subscriptions.filter((item)=>item.status==="canceled").length,
    noSubscription:Math.max(0,totalWorkspaces-subscriptions.length),
    byPlan,
    mrrInr,
    revenueConfigured,
  };
}

function requireBillingAdmin(session: AppSession) {
  if (session.role !== "admin") throw new Error("BILLING_ADMIN_REQUIRED");
  if (!usePostgres()) throw new Error("DATABASE_MODE_REQUIRED");
}

function origin(fallback?: string) {
  const configured=process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/,"");
  return configured || fallback?.replace(/\/$/,"") || "https://ai-marketing-os.vercel.app";
}

function stripeHeaders() {
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  return {
    Authorization: "Bearer "+secret,
    "Content-Type": "application/x-www-form-urlencoded",
    ...(process.env.STRIPE_API_VERSION ? {"Stripe-Version": process.env.STRIPE_API_VERSION} : {}),
  };
}

async function stripePost<T>(path:string, fields:URLSearchParams):Promise<T> {
  const response=await fetch("https://api.stripe.com"+path,{method:"POST",headers:stripeHeaders(),body:fields,cache:"no-store"});
  const body=await response.json().catch(()=>({})) as T & {error?:{message?:string}};
  if(!response.ok) throw new Error(body.error?.message || "Stripe request failed.");
  return body;
}

async function stripeGet<T>(path:string):Promise<T> {
  const response=await fetch("https://api.stripe.com"+path,{headers:stripeHeaders(),cache:"no-store"});
  const body=await response.json().catch(()=>({})) as T & {error?:{message?:string}};
  if(!response.ok) throw new Error(body.error?.message || "Stripe request failed.");
  return body;
}

export async function getWorkspaceBilling(session:AppSession) {
  const setup=getBillingSetupState();
  if(!usePostgres()) return {
    configured: setup.checkoutConfigured,
    webhookConfigured: setup.webhookConfigured,
    subscription:null,
    usage:{members:1,socialConnections:0,socialPostsThisMonth:0},
  };

  const prisma=getPrisma();
  const start=new Date();
  start.setUTCDate(1);
  start.setUTCHours(0,0,0,0);
  const brand=await prisma.brand.findFirst({where:{workspaceId:session.workspaceId},orderBy:{createdAt:"asc"},select:{id:true}});
  const [subscription,members,socialConnections,socialPostsThisMonth]=await Promise.all([
    prisma.workspaceSubscription.findUnique({where:{workspaceId:session.workspaceId}}),
    prisma.workspaceAccess.count({where:{workspaceId:session.workspaceId}}),
    brand ? prisma.integrationConnection.count({where:{brandId:brand.id,status:"connected"}}) : Promise.resolve(0),
    brand ? prisma.socialPost.count({where:{brandId:brand.id,createdAt:{gte:start}}}) : Promise.resolve(0),
  ]);
  return {
    configured:setup.checkoutConfigured,
    webhookConfigured:setup.webhookConfigured,
    subscription:subscription ? {
      planKey:planKey(subscription.planKey),
      status:subscription.status,
      customerId:subscription.stripeCustomerId || undefined,
      subscriptionId:subscription.stripeSubscriptionId || undefined,
      currentPeriodEnd:subscription.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd:subscription.cancelAtPeriodEnd,
    }:null,
    usage:{members,socialConnections,socialPostsThisMonth},
  };
}

export async function createStripeCheckout(session:AppSession, requestedPlan:BillingPlanKey, requestOrigin?:string) {
  requireBillingAdmin(session);
  const plan=getBillingPlans().find((item)=>item.key===requestedPlan);
  if(!plan?.priceId) throw new Error("PLAN_PRICE_NOT_CONFIGURED");
  const prisma=getPrisma();
  const current=await prisma.workspaceSubscription.findUnique({where:{workspaceId:session.workspaceId}});
  if(shouldManageSubscriptionInPortal(current?.status,current?.stripeSubscriptionId || undefined)){
    throw new Error("BILLING_MANAGE_EXISTING_SUBSCRIPTION_IN_PORTAL");
  }
  const fields=new URLSearchParams();
  fields.set("mode","subscription");
  fields.set("success_url",origin(requestOrigin)+"/billing?status=success");
  fields.set("cancel_url",origin(requestOrigin)+"/billing?status=cancelled");
  fields.set("line_items[0][price]",plan.priceId);
  fields.set("line_items[0][quantity]","1");
  fields.set("client_reference_id",session.workspaceId);
  fields.set("allow_promotion_codes","true");
  fields.set("metadata[workspaceId]",session.workspaceId);
  fields.set("metadata[planKey]",requestedPlan);
  fields.set("subscription_data[metadata][workspaceId]",session.workspaceId);
  fields.set("subscription_data[metadata][planKey]",requestedPlan);
  if(current?.stripeCustomerId) fields.set("customer",current.stripeCustomerId);
  else fields.set("customer_email",session.email);
  const checkout=await stripePost<{id:string;url?:string;customer?:string|null}>("/v1/checkout/sessions",fields);
  await prisma.workspaceSubscription.upsert({
    where:{workspaceId:session.workspaceId},
    create:{workspaceId:session.workspaceId,provider:"stripe",planKey:requestedPlan,status:"checkout_pending",stripeCustomerId:typeof checkout.customer==="string"?checkout.customer:null},
    update:{planKey:requestedPlan,status:"checkout_pending",...(typeof checkout.customer==="string"?{stripeCustomerId:checkout.customer}:{})},
  });
  await recordAuditEvent({
    workspaceId:session.workspaceId,
    actorType:session.platformAdmin?"platform_admin":"workspace_user",
    actorId:session.userId,
    action:"billing_checkout_started",
    entityType:"WorkspaceSubscription",
    payload:{planKey:requestedPlan,checkoutSessionId:checkout.id},
  });
  if(!checkout.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
  return checkout.url;
}

export async function createStripePortal(session:AppSession, requestOrigin?:string) {
  requireBillingAdmin(session);
  const prisma=getPrisma();
  const subscription=await prisma.workspaceSubscription.findUnique({where:{workspaceId:session.workspaceId}});
  if(!subscription?.stripeCustomerId) throw new Error("BILLING_CUSTOMER_REQUIRED");
  const fields=new URLSearchParams({customer:subscription.stripeCustomerId,return_url:origin(requestOrigin)+"/billing"});
  const portal=await stripePost<{url?:string}>("/v1/billing_portal/sessions",fields);
  await recordAuditEvent({
    workspaceId:session.workspaceId,
    actorType:session.platformAdmin?"platform_admin":"workspace_user",
    actorId:session.userId,
    action:"billing_portal_opened",
    entityType:"WorkspaceSubscription",
    entityId:subscription.id,
  });
  if(!portal.url) throw new Error("STRIPE_PORTAL_URL_MISSING");
  return portal.url;
}

function signatureParts(header:string) {
  const result:{timestamp?:string;signatures:string[]}={signatures:[]};
  for(const part of header.split(",")){
    const [key,value]=part.split("=",2);
    if(key==="t") result.timestamp=value;
    if(key==="v1"&&value) result.signatures.push(value);
  }
  return result;
}

export function verifyStripeWebhook(rawBody:string, header:string|null) {
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!header) return false;
  const parsed=signatureParts(header);
  if(!parsed.timestamp||!parsed.signatures.length) return false;
  const timestamp=Number(parsed.timestamp);
  if(!Number.isFinite(timestamp)||Math.abs(Math.floor(Date.now()/1000)-timestamp)>300) return false;
  const expected=createHmac("sha256",secret).update(parsed.timestamp+"."+rawBody).digest("hex");
  return parsed.signatures.some((candidate)=>{
    const a=Buffer.from(expected);
    const b=Buffer.from(candidate);
    return a.length===b.length && timingSafeEqual(a,b);
  });
}

type StripeSubscription={
  id:string;
  customer?:string|{id?:string}|null;
  status?:string;
  current_period_end?:number;
  cancel_at_period_end?:boolean;
  metadata?:Record<string,string>;
  items?:{data?:Array<{price?:{id?:string}}>} ;
};

function planFromPrice(priceId?:string) {
  return getBillingPlans().find((item)=>item.priceId&&item.priceId===priceId)?.key;
}

export async function syncStripeSubscription(object:StripeSubscription) {
  if(!usePostgres()) return;
  const prisma=getPrisma();
  const existing=await prisma.workspaceSubscription.findFirst({where:{stripeSubscriptionId:object.id}});
  const workspaceId=object.metadata?.workspaceId || existing?.workspaceId;
  if(!workspaceId) throw new Error("STRIPE_WORKSPACE_METADATA_MISSING");
  const customerId=typeof object.customer==="string"?object.customer:object.customer?.id;
  const selectedPlan=planKey(planFromPrice(object.items?.data?.[0]?.price?.id) || object.metadata?.planKey || existing?.planKey);
  await prisma.workspaceSubscription.upsert({
    where:{workspaceId},
    create:{
      workspaceId,provider:"stripe",planKey:selectedPlan,status:object.status||"active",
      stripeCustomerId:customerId||null,stripeSubscriptionId:object.id,
      currentPeriodEnd:object.current_period_end?new Date(object.current_period_end*1000):null,
      cancelAtPeriodEnd:Boolean(object.cancel_at_period_end),
    },
    update:{
      planKey:selectedPlan,status:object.status||"active",
      ...(customerId?{stripeCustomerId:customerId}:{}),
      stripeSubscriptionId:object.id,
      currentPeriodEnd:object.current_period_end?new Date(object.current_period_end*1000):null,
      cancelAtPeriodEnd:Boolean(object.cancel_at_period_end),
    },
  });
  await recordAuditEvent({
    workspaceId,
    actorType:"stripe_webhook",
    action:"billing_subscription_synced",
    entityType:"WorkspaceSubscription",
    entityId:object.id,
    payload:{
      planKey:selectedPlan,
      status:object.status||"active",
      cancelAtPeriodEnd:Boolean(object.cancel_at_period_end),
      currentPeriodEnd:object.current_period_end||null,
    },
  });
}

export async function processStripeWebhook(rawBody:string) {
  const event=JSON.parse(rawBody) as {id?:string;type?:string;data?:{object?:Record<string,unknown>}};
  const object=event.data?.object;
  if(!event.type||!object) return;

  const prisma=usePostgres()?getPrisma():null;
  let claimedEvent=false;
  if(prisma&&event.id){
    try{
      await prisma.billingWebhookEvent.create({data:{eventId:event.id,type:event.type}});
      claimedEvent=true;
    }catch(error){
      if((error as {code?:string}).code==="P2002") return;
      throw error;
    }
  }

  try{
    if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type)){
      await syncStripeSubscription(object as StripeSubscription);
    }else if(event.type==="checkout.session.completed"){
      const checkout=object as {subscription?:string|null;customer?:string|null;client_reference_id?:string|null;metadata?:Record<string,string>};
      const workspaceId=checkout.metadata?.workspaceId || checkout.client_reference_id || undefined;
      if(workspaceId){
        if(checkout.subscription){
          const subscription=await stripeGet<StripeSubscription>("/v1/subscriptions/"+encodeURIComponent(checkout.subscription));
          await syncStripeSubscription(subscription);
        }else if(prisma){
          await prisma.workspaceSubscription.upsert({
            where:{workspaceId},
            create:{workspaceId,provider:"stripe",planKey:planKey(checkout.metadata?.planKey),status:"checkout_complete",stripeCustomerId:checkout.customer||null},
            update:{status:"checkout_complete",...(checkout.customer?{stripeCustomerId:checkout.customer}:{})},
          });
        }
      }
    }

    if(prisma&&claimedEvent&&event.id){
      await prisma.billingWebhookEvent.update({where:{eventId:event.id},data:{processedAt:new Date()}});
    }
  }catch(error){
    if(prisma&&claimedEvent&&event.id){
      await prisma.billingWebhookEvent.delete({where:{eventId:event.id}}).catch(()=>undefined);
    }
    throw error;
  }
}
