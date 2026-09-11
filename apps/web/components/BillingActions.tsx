"use client";

import { useState } from "react";
import type { BillingPlanKey } from "../lib/billing";

export function BillingActions({planKey,checkoutEnabled,canManage,showPortal,portalLabel="Manage in Stripe"}:{planKey:BillingPlanKey;checkoutEnabled:boolean;canManage:boolean;showPortal?:boolean;portalLabel?:string}){
  const [busy,setBusy]=useState<"checkout"|"portal"|null>(null);
  const [error,setError]=useState("");

  async function checkout(){
    setBusy("checkout");setError("");
    try{
      const response=await fetch("/api/billing/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({planKey})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||"Unable to open checkout.");
      window.location.assign(body.url);
    }catch(err){setError(err instanceof Error?err.message:"Unable to open checkout.");setBusy(null);}
  }

  async function portal(){
    setBusy("portal");setError("");
    try{
      const response=await fetch("/api/billing/portal",{method:"POST"});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||"Unable to open billing portal.");
      window.location.assign(body.url);
    }catch(err){setError(err instanceof Error?err.message:"Unable to open billing portal.");setBusy(null);}
  }

  return <div className="billing-actions">
    {showPortal
      ? <button className="btn secondary" type="button" disabled={!canManage||busy!==null} onClick={portal}>{busy==="portal"?"Opening…":portalLabel}</button>
      : <button className="btn" type="button" disabled={!canManage||!checkoutEnabled||busy!==null} onClick={checkout}>{busy==="checkout"?"Opening…":checkoutEnabled?"Choose plan":"Setup required"}</button>}
    {error&&<small className="billing-action-error">{error}</small>}
  </div>;
}
