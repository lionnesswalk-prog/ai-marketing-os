import { NextResponse } from "next/server";
import { processStripeWebhook, verifyStripeWebhook } from "../../../../lib/billing";

export const runtime="nodejs";

export async function POST(request:Request){
  const rawBody=await request.text();
  if(!verifyStripeWebhook(rawBody,request.headers.get("stripe-signature"))){
    return NextResponse.json({error:"Invalid Stripe signature."},{status:400});
  }
  try{
    await processStripeWebhook(rawBody);
    return NextResponse.json({received:true});
  }catch(error){
    console.error("Stripe webhook processing failed",error);
    return NextResponse.json({error:"Webhook processing failed."},{status:500});
  }
}
