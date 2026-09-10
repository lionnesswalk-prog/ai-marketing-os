# AI Marketing OS

AI-powered marketing operations platform for campaign strategy, paid-media diagnostics, social content, inbound inquiries, and controlled budget optimization.

## What is already implemented

The source currently includes:
- marketing command-center dashboard,
- deterministic campaign diagnostics,
- approval-gated budget recommendations,
- interactive approval queue,
- AI campaign strategy builder,
- social content planner,
- safe inquiry reply drafting,
- memory-mode demo repository,
- PostgreSQL/Prisma 7 data model and repository path,
- development role checks,
- audit-log write path for PostgreSQL approval decisions,
- OpenAI Agents SDK specialist agents and live/mock runtime modes.

See `docs/IMPLEMENTATION_STATUS.md` for exact verification status and remaining work.

## Architecture

```text
Web Dashboard
      |
API / Application Services
      |
Marketing Orchestrator
  |       |        |        |
Strategy  Optimizer Content  Inquiry
Agent     Logic     Agent    Agent
      \      |      /
       Policy + Approval Layer
               |
     Provider Adapter Contracts
        |        |        |
      Meta     Google   Messaging
               |
        PostgreSQL / Prisma
```

A key design decision is that financial safety is enforced in deterministic application code, not trusted to model instructions alone.

## Safety defaults

- Spend changes require human approval.
- Budget increases are capped at 20% per action.
- Budget decreases are capped at 50% per action.
- Pauses require approval.
- Customer replies must not invent stock, shipping, discount, refund or exclusivity facts.
- Sensitive or ambiguous customer cases are intended to escalate to a human.

## Fast local start — no external credentials

```bash
cp .env.example .env
npm install
npm run dev
```

The defaults use:

```env
DATA_BACKEND=memory
AI_MODE=mock
AUTH_MODE=dev
```

This allows the dashboard and workflows to run before Meta, Google, PostgreSQL or OpenAI credentials are connected.

## Main routes

- `/dashboard`
- `/campaigns`
- `/strategy`
- `/social`
- `/leads`
- `/approvals`
- `/api/health`

## Live OpenAI agents

The project uses the current TypeScript `@openai/agents` package. Enable live mode with:

```env
AI_MODE=live
OPENAI_API_KEY=...
```

Without those values, strategy/content/inquiry workflows intentionally use deterministic mock outputs.

## PostgreSQL / Prisma

The project is configured for Prisma 7 with the PostgreSQL driver adapter.

```bash
npm run prisma:generate
npm run db:migrate -- --name init
npm run db:seed
```

Then set:

```env
DATA_BACKEND=postgres
```

## Project structure

```text
apps/web/                    Next.js UI and API routes
apps/web/components/         interactive client components
apps/web/lib/                repository, auth and runtime data layer
packages/agents/             OpenAI specialist agents + runtime
packages/core/               metrics, diagnostics and deterministic guardrails
packages/integrations/       provider contracts and mocks
prisma/                      PostgreSQL schema
scripts/                     database seed
 tests/                      core behavior tests
 docs/                       blueprint, integrations and roadmap
```

## Next milestone

Connect real Meta and Google accounts, ingest live metrics, persist recommendations, and execute only user-approved actions. After that, add Instagram/WhatsApp inbound messaging and verified catalog/inventory tools.
