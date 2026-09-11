import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../lib/auth";
import { createStripeCheckout } from "../../../../lib/billing";

const schema=z.object({planKey:z.enum(["starter","growth","scale"])});

export async function POST(request:Request){
  const session=await getSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Choose a valid billing plan."},{status:400});
  try{
    const url=await createStripeCheckout(session,parsed.data.planKey,new URL(request.url).origin);
    return NextResponse.json({ok:true,url});
  }catch(error){
    const code=error instanceof Error?error.message:"UNKNOWN";
    const messages:Record<string,string>={
      BILLING_ADMIN_REQUIRED:"Only workspace admins can change billing.",
      DATABASE_MODE_REQUIRED:"Billing requires production database mode.",
      PLAN_PRICE_NOT_CONFIGURED:"This plan does not have a Stripe Price ID configured yet.",
      STRIPE_NOT_CONFIGURED:"Stripe billing is not configured yet.",
    };
    return NextResponse.json({error:messages[code]||code},{status:400});
  }
}
