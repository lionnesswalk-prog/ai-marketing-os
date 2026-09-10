# MVP Roadmap

## Release A — Foundation
- Next.js shell + auth
- PostgreSQL schema
- workspace/brand roles
- integration credential model
- campaign metric ingestion pipeline
- dashboard

Acceptance: one brand can see normalized campaign metrics from a connected source.

## Release B — AI recommendations
- strategist agent
- optimizer agent
- metric diagnosis functions
- structured recommendation schema
- approval queue
- audit log

Acceptance: system generates a recommendation from real metrics and cannot execute a spend-changing action without approval.

## Release C — Lead inbox
- inbound webhook adapter
- Instagram/WhatsApp/website lead normalization
- conversation view
- verified knowledge tools
- intent scoring
- human escalation

Acceptance: inbound inquiry becomes a lead, AI can safely draft/answer configured FAQs, and escalations are visible.

## Release D — Social media operations
- brand voice profile
- content pillars
- weekly calendar
- post/reel/carousel concepts
- caption/copy generation
- campaign alignment
- asset status
- scheduling integration
- post performance analysis
- content learnings memory

Acceptance: generate a month plan and retain performance learnings by content type.

## Release E — Controlled execution
- approved budget updates
- campaign pause/resume
- rollback
- change cooldowns
- anomaly checks

Acceptance: approved action executes through provider adapter and is fully auditable.
