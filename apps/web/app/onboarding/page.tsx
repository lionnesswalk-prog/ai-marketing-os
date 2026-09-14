import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth";
import { getCurrentBrandProfile, updateBrandProfile } from "../../lib/brand-profile";
import { listIndustryOptions } from "../../lib/industry-intelligence";

async function onboardingAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const current = await getCurrentBrandProfile(session);

  const name = String(formData.get("name") ?? current.name).trim();
  const website = String(formData.get("website") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const market = String(formData.get("market") ?? "").trim();
  const businessModel = String(formData.get("businessModel") ?? "").trim();
  const primaryGoal = String(formData.get("primaryGoal") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();

  if (name.length < 2 || industry.length < 2 || market.length < 2 || businessModel.length < 2 || primaryGoal.length < 3) {
    redirect("/onboarding?error=required");
  }

  await updateBrandProfile(session, {
    name,
    website,
    industry,
    market,
    businessModel,
    primaryGoal,
    audience,
    positioning,
    voice: current.voice || "Clear, specific, credible and consistent with the brand.",
    proofPoints: current.proofPoints,
    avoid: current.avoid || "Unsupported claims\nFake urgency\nInvented product facts",
    notes: current.notes,
  });

  redirect("/dashboard?onboarding=complete");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const profile = await getCurrentBrandProfile(session);
  const params = searchParams ? await searchParams : undefined;
  const options = listIndustryOptions();

  return (
    <div>
      <div className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">WORKSPACE ONBOARDING</p>
          <h1>Teach AI Marketing OS how your business works.</h1>
          <p className="muted large">
            Industry, market and business-model context determine the funnel, KPI families and channel priorities used by strategy, social and inquiry AI.
          </p>
        </div>
        <div className="hero-badges">
          <span className="pill accent">Free beta</span>
          <span className="pill">Workspace isolated</span>
        </div>
      </div>

      <section className="card" style={{ maxWidth: 900 }}>
        <div className="section-head">
          <div><p className="eyebrow">BUSINESS CONTEXT</p><h2>Core setup</h2></div>
          <span className="pill">Required once</span>
        </div>

        {params?.error === "required" && (
          <div className="error-box">Complete the required business fields before continuing.</div>
        )}

        <form action={onboardingAction}>
          <div className="brand-profile-grid">
            <label>Brand / company name
              <input name="name" defaultValue={profile.name} minLength={2} required />
            </label>
            <label>Website
              <input name="website" type="url" defaultValue={profile.website} placeholder="https://yourbrand.com" />
            </label>
            <label>Industry / category
              <select name="industry" defaultValue={profile.industry || ""} required>
                <option value="" disabled>Choose industry</option>
                {options.map((item) => <option key={item.key} value={item.label}>{item.label}</option>)}
                <option value="Other / Custom">Other / Custom</option>
              </select>
            </label>
            <label>Primary market
              <input name="market" defaultValue={profile.market} placeholder="India, UAE, UK, global..." required />
            </label>
            <label>Business model
              <select name="businessModel" defaultValue={profile.businessModel || ""} required>
                <option value="" disabled>Choose model</option>
                <option value="D2C / E-commerce">D2C / E-commerce</option>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
                <option value="B2B SaaS">B2B SaaS</option>
                <option value="Marketplace">Marketplace</option>
                <option value="Local service">Local service</option>
                <option value="Agency / Professional service">Agency / Professional service</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>Primary business goal
              <input name="primaryGoal" defaultValue={profile.primaryGoal} placeholder="Profitable growth, qualified leads, bookings..." required />
            </label>
          </div>

          <label>Core audience
            <textarea name="audience" rows={4} defaultValue={profile.audience} placeholder="Who buys, why they buy, geography, price sensitivity, buying context." />
          </label>
          <label>Positioning
            <textarea name="positioning" rows={4} defaultValue={profile.positioning} placeholder="What makes the brand meaningfully different and why the right customer should care." />
          </label>

          <div className="profile-notice">
            AI accuracy rule: industry guidance is used as operating context only. Numeric benchmarks, historical results, stock, pricing and policies are never treated as facts unless you provide or connect a verified source.
          </div>
          <button className="btn" type="submit">Complete workspace setup</button>
        </form>
      </section>
    </div>
  );
}
