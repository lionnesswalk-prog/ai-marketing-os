export type IndustryPlaybook = {
  key: string;
  label: string;
  aliases: string[];
  primaryFunnel: string[];
  priorityKpis: string[];
  channelPriorities: string[];
  seasonality: string[];
  dataToVerify: string[];
  cautions: string[];
};

const playbooks: IndustryPlaybook[] = [
  {
    key: "fashion",
    label: "Fashion & Apparel",
    aliases: ["fashion", "apparel", "clothing", "luxury fashion", "womenswear", "menswear", "streetwear", "jewellery", "jewelry", "accessories"],
    primaryFunnel: ["Discovery", "Product consideration", "Product-page engagement", "Add to cart", "Checkout", "Repeat purchase"],
    priorityKpis: ["MER / blended revenue efficiency", "ROAS where attribution is reliable", "CAC / CPA", "Conversion rate", "AOV", "Repeat purchase rate", "Creative hold rate", "CTR"],
    channelPriorities: ["Instagram / Meta", "Google Search & Shopping", "Creator content", "Email / CRM", "Pinterest where visual discovery is relevant"],
    seasonality: ["New collection or drop dates", "Festive and gifting periods", "Sale periods", "Weather / seasonal wardrobe shifts"],
    dataToVerify: ["Margin by product", "Inventory / availability", "AOV", "Repeat purchase window", "Best-selling categories", "Geographic demand"],
    cautions: ["Do not treat platform ROAS as fully incremental.", "Creative fatigue can materially change paid-social performance.", "Never invent stock, pricing, discount or exclusivity."],
  },
  {
    key: "ecommerce",
    label: "E-commerce / D2C",
    aliases: ["ecommerce", "e-commerce", "d2c", "direct to consumer", "retail", "consumer brand"],
    primaryFunnel: ["Reach", "Qualified session", "Product view", "Add to cart", "Checkout", "Purchase", "Repeat purchase"],
    priorityKpis: ["CAC / CPA", "MER", "Conversion rate", "AOV", "Contribution margin", "Repeat purchase rate", "Refund / return rate"],
    channelPriorities: ["Meta", "Google Search / Shopping", "Email / CRM", "Creator / affiliate", "Organic social"],
    seasonality: ["Promotional calendar", "Festivals / holidays", "Inventory cycles", "Category-specific peaks"],
    dataToVerify: ["Gross margin", "Shipping cost", "Return rate", "AOV", "LTV", "Inventory status", "Channel attribution quality"],
    cautions: ["Revenue alone is not profitability.", "Discount-led growth can damage contribution margin.", "Use blended metrics alongside platform-reported attribution."],
  },
  {
    key: "saas",
    label: "SaaS / Software",
    aliases: ["saas", "software", "b2b software", "app", "technology", "tech"],
    primaryFunnel: ["Demand creation", "Qualified visit", "Signup / demo", "Activation", "Qualified opportunity", "Paid conversion", "Retention"],
    priorityKpis: ["CAC", "Qualified pipeline", "Activation rate", "Trial-to-paid / demo-to-close", "Payback period", "Retention", "LTV:CAC"],
    channelPriorities: ["Google Search", "LinkedIn", "Content / SEO", "Lifecycle email", "Retargeting", "Partner / community"],
    seasonality: ["Budget cycles", "Quarter-end", "Industry events", "Product launches"],
    dataToVerify: ["ACV / ARPA", "Sales cycle", "Activation definition", "Close rate", "Gross margin", "Retention", "ICP"],
    cautions: ["Lead volume without qualification can be misleading.", "Pipeline and revenue lag media activity.", "Do not use consumer-commerce benchmarks for B2B SaaS."],
  },
  {
    key: "services",
    label: "Professional / Local Services",
    aliases: ["services", "agency", "consulting", "professional services", "local services", "salon", "clinic", "studio"],
    primaryFunnel: ["Discovery", "Qualified inquiry", "Consultation / booking", "Show-up", "Sale", "Repeat / referral"],
    priorityKpis: ["Cost per qualified lead", "Lead-to-booking rate", "Show rate", "Close rate", "Revenue per lead", "Capacity utilization"],
    channelPriorities: ["Google Search", "Meta", "Local SEO / Maps", "WhatsApp / phone follow-up", "Referral / CRM"],
    seasonality: ["Local demand patterns", "Holiday periods", "Appointment capacity", "Weather / event-driven demand"],
    dataToVerify: ["Service area", "Capacity", "Average ticket", "Close rate", "Lead response time", "Repeat frequency"],
    cautions: ["Cheap leads are not necessarily qualified leads.", "Operational capacity must constrain demand generation.", "Track offline outcomes back to source where possible."],
  },
  {
    key: "hospitality",
    label: "Hospitality / Travel / Food",
    aliases: ["hospitality", "hotel", "restaurant", "food", "travel", "resort", "cafe", "tourism"],
    primaryFunnel: ["Discovery", "Intent / availability check", "Reservation / booking", "Visit / stay", "Review", "Repeat"],
    priorityKpis: ["Direct booking / reservation rate", "Cost per booking", "Occupancy / covers where relevant", "Average booking value", "Repeat rate", "Review quality"],
    channelPriorities: ["Google Search / Maps", "Meta / Instagram", "Travel / booking platforms", "CRM", "Creator content"],
    seasonality: ["Weekday vs weekend", "Holiday / travel seasons", "Local events", "Meal periods / booking windows"],
    dataToVerify: ["Capacity / availability", "Average booking value", "Cancellation rate", "Location demand", "Lead time", "Channel commission"],
    cautions: ["Availability changes quickly and must be verified.", "Third-party platform performance should be separated from direct demand.", "Do not promise booking inventory without a live source."],
  },
  {
    key: "education",
    label: "Education / Courses",
    aliases: ["education", "course", "training", "coaching", "edtech", "school", "academy"],
    primaryFunnel: ["Awareness", "Qualified lead", "Counselling / webinar", "Application / checkout", "Enrollment", "Completion / referral"],
    priorityKpis: ["Cost per qualified lead", "Lead-to-enrollment rate", "Show-up rate", "CAC", "Revenue per cohort", "Completion / retention"],
    channelPriorities: ["Meta", "Google Search", "YouTube", "Webinars / events", "WhatsApp / CRM"],
    seasonality: ["Admission cycles", "Exam calendars", "Cohort start dates", "Career / hiring cycles"],
    dataToVerify: ["Course price", "Seats / cohort capacity", "Eligibility", "Enrollment deadlines", "Historical close rate", "Refund policy"],
    cautions: ["Avoid outcome or salary guarantees.", "Lead quality matters more than raw lead volume.", "Admissions and eligibility claims must come from verified policy."],
  },
  {
    key: "real_estate",
    label: "Real Estate",
    aliases: ["real estate", "property", "developer", "broker", "brokerage"],
    primaryFunnel: ["Demand generation", "Qualified lead", "Site visit / consultation", "Negotiation", "Booking", "Sale"],
    priorityKpis: ["Cost per qualified lead", "Lead-to-site-visit", "Site-visit-to-booking", "CAC", "Pipeline value", "Sales cycle"],
    channelPriorities: ["Meta", "Google Search", "Property portals", "YouTube", "WhatsApp / CRM"],
    seasonality: ["Project launches", "Interest-rate environment", "Festive buying periods", "Local inventory cycles"],
    dataToVerify: ["Location", "Price range", "Inventory", "Possession / delivery status", "Legal approvals", "Lead qualification criteria"],
    cautions: ["Never invent availability, approvals, pricing or possession dates.", "Lead quality and offline follow-up dominate outcomes.", "Long sales cycles make short-window attribution noisy."],
  },
  {
    key: "health_wellness",
    label: "Health / Wellness",
    aliases: ["health", "wellness", "fitness", "medical", "healthcare", "nutrition", "gym"],
    primaryFunnel: ["Education", "Qualified inquiry", "Consultation / trial", "Purchase / membership", "Adherence", "Renewal"],
    priorityKpis: ["Cost per qualified inquiry", "Booking / trial rate", "Conversion rate", "Retention", "Revenue per member / patient"],
    channelPriorities: ["Google Search", "Meta", "YouTube", "Local discovery", "CRM"],
    seasonality: ["New-year demand", "Seasonal wellness goals", "Local events", "Membership renewal cycles"],
    dataToVerify: ["Services offered", "Professional qualifications", "Pricing", "Capacity", "Medical / compliance restrictions", "Retention"],
    cautions: ["Do not generate unsupported medical claims.", "Sensitive targeting and regulated-ad policies may apply.", "Human review is required for clinical or treatment claims."],
  },
];

const generic: IndustryPlaybook = {
  key: "general",
  label: "General Business",
  aliases: [],
  primaryFunnel: ["Awareness", "Consideration", "Qualified action", "Conversion", "Retention"],
  priorityKpis: ["Qualified conversion rate", "CAC / CPA", "Revenue efficiency", "Retention / repeat rate", "Channel contribution"],
  channelPriorities: ["Search where demand exists", "Social where discovery matters", "CRM / lifecycle", "Content / organic"],
  seasonality: ["Business-specific demand cycles", "Promotional calendar", "Capacity constraints"],
  dataToVerify: ["Offer economics", "Target customer", "Conversion definition", "Margin", "Sales cycle", "Historical channel data"],
  cautions: ["Do not use unrelated industry benchmarks.", "Separate verified facts from assumptions.", "Prefer first-party performance data over generic averages."],
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getIndustryPlaybook(industry: string): IndustryPlaybook {
  const target = normalize(industry);
  if (!target) return generic;
  return playbooks.find((item) => item.aliases.some((alias) => target.includes(alias) || alias.includes(target))) || generic;
}

export function buildIndustryAIContext(input: {
  industry: string;
  market?: string;
  businessModel?: string;
  primaryGoal?: string;
}) {
  const playbook = getIndustryPlaybook(input.industry);
  return [
    "INDUSTRY OPERATING CONTEXT",
    `Industry playbook: ${playbook.label}`,
    input.industry ? `User-selected industry/category: ${input.industry}` : "",
    input.market ? `Primary market: ${input.market}` : "",
    input.businessModel ? `Business model: ${input.businessModel}` : "",
    input.primaryGoal ? `Primary business goal: ${input.primaryGoal}` : "",
    `Typical funnel stages: ${playbook.primaryFunnel.join(" → ")}`,
    `Priority KPI families: ${playbook.priorityKpis.join("; ")}`,
    `Common channel priorities to evaluate, not assume: ${playbook.channelPriorities.join("; ")}`,
    `Seasonality factors to check: ${playbook.seasonality.join("; ")}`,
    `Data that should be verified before strong recommendations: ${playbook.dataToVerify.join("; ")}`,
    `Industry cautions: ${playbook.cautions.join(" ")}`,
    "Accuracy rule: this playbook is qualitative operating guidance, not a source of numeric benchmark facts. Do not invent benchmark percentages, market sizes or historical results.",
  ].filter(Boolean).join("\n");
}

export function listIndustryOptions() {
  return playbooks.map((item) => ({ key: item.key, label: item.label }));
}
