import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { createStripePortal } from "../../../../lib/billing";

export async function POST(request:Request){
  const session=await getSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const url=await createStripePortal(session,new URL(request.url).origin);
    return NextResponse.json({ok:true,url});
  }catch(error){
    const code=error instanceof Error?error.message:"UNKNOWN";
    const messages:Record<string,string>={
      BILLING_ADMIN_REQUIRED:"Only workspace admins can manage billing.",
      DATABASE_MODE_REQUIRED:"Billing requires production database mode.",
      BILLING_CUSTOMER_REQUIRED:"No Stripe billing customer exists for this workspace yet.",
      STRIPE_NOT_CONFIGURED:"Stripe billing is not configured yet.",
    };
    return NextResponse.json({error:messages[code]||code},{status:400});
  }
}
