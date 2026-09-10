# API Integration Plan

## Meta / Instagram

Use a provider adapter rather than calling platform endpoints from agent prompts. The adapter exposes normalized methods such as:
- list campaigns
- read insight windows
- update approved budget
- pause/resume approved campaigns
- fetch inbound Instagram messages
- send replies

All write operations pass through the approval/policy service first.

## Google Ads

Normalize Google reporting into the common CampaignMetric schema. Keep raw platform ids and payload references for debugging.

## WhatsApp

Use webhook ingestion for incoming conversations and a messaging provider for replies. Verify templates/policy restrictions at execution time.

## Webhooks

Recommended pattern:
- verify signature/token
- persist raw event id
- deduplicate
- enqueue processing job
- transform into normalized domain event
- invoke relevant agent/tool
- persist output and audit record

## OAuth / credential storage

Never store access tokens in plaintext application logs. Encrypt persistent credentials, separate per workspace, rotate where platform supports it, and use least privilege.
