# Implementation Status — Phase 1 Foundation

## Working in the current source

### Dashboard
- Aggregates tracked spend and revenue.
- Calculates ROAS.
- Shows open lead count, pending approvals, and campaigns needing action.
- Shows current marketing insights.

### Campaign diagnostics
The deterministic diagnostics layer currently evaluates:
- CTR,
- click-to-conversion rate,
- ROAS,
- frequency,
- minimum delivery/spend thresholds.

It can propose:
- creative refresh,
- landing-page inspection,
- controlled budget decrease,
- controlled budget increase.

### Budget safety policy
Starter rules:
- any spend change requires human approval,
- budget increases are capped at 20% per action,
- budget decreases are capped at 50% per action,
- pauses require approval,
- new campaign launches are intended to require approval in the execution milestone.

The safety policy is deterministic code and is not delegated to the LLM.

### Approval queue
- Lists spend-impacting recommendations.
- Admin and marketing-manager roles can approve or reject.
- Memory mode mutates the in-process demo state.
- PostgreSQL mode writes decisions and an audit event.

### AI strategy builder
- Accepts brand, budget, objective and product context.
- Works in mock mode without an API key.
- Uses the OpenAI Agents SDK in live mode.
- Produces channel allocation, audiences, creative angles, KPIs, test plan, risks and assumptions.

### Social content planner
- Produces platform/format-specific hooks, captions and CTAs.
- Mock mode is immediately testable.
- Live mode uses the Social Content Agent.

### Inquiry assistant
- Generates safe reply drafts.
- It does not claim product stock, delivery, discount, refund or exclusivity without verified facts.
- Missing facts are surfaced for verification.

### Data architecture
Two modes are supported:

`DATA_BACKEND=memory`
- default,
- zero database setup,
- useful for UI and workflow testing.

`DATA_BACKEND=postgres`
- Prisma 7 + PostgreSQL,
- data models for workspace, brand, users, campaigns, metrics, optimization actions, approvals, leads, messages, social posts, integrations, insights and audit logs.

## Verification performed in the build environment

- All TypeScript/TSX source files were syntax-transpiled successfully.
- Core TypeScript modules passed strict type checking independently.
- Core runtime behavior was executed and verified:
  - 75% budget increase request was capped to 20%,
  - approval was required,
  - weak campaign was classified as `needs_action`,
  - strong campaign produced an approval-gated scale recommendation.

Full dependency installation could not complete in the build environment because the npm install operation timed out. The source therefore was not fully Next.js production-built here. Run the setup commands below in a normal networked development environment.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Default modes are:

```env
DATA_BACKEND=memory
AI_MODE=mock
AUTH_MODE=dev
```

Open:

- `/dashboard`
- `/campaigns`
- `/strategy`
- `/social`
- `/leads`
- `/approvals`

## Enable live OpenAI agents

```env
AI_MODE=live
OPENAI_API_KEY=your_key_here
```

Restart the app after changing environment variables.

## Enable PostgreSQL

Set:

```env
DATA_BACKEND=postgres
DATABASE_URL=postgresql://...
```

Then run:

```bash
npm run prisma:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

## Next development milestone

1. Real identity provider/OAuth instead of development session.
2. Meta ad-account OAuth and campaign metric sync.
3. Google Ads account connection and metric sync.
4. Persist AI diagnoses and create approval records automatically.
5. Execute only approved spend changes through provider adapters.
6. Instagram/WhatsApp webhook ingestion.
7. Verified catalog/inventory tools for inquiry handling.
8. Social publishing/scheduling integrations.
9. Job queue, retries, idempotency and audit/tracing hardening.
