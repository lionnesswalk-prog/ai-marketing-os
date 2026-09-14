# Production Activation

The application code is ready for database-backed authentication and OAuth-backed social integrations. External services still require account-owned credentials and consent.

## 1. PostgreSQL

Create a PostgreSQL database and set `DATABASE_URL` in the Vercel Production environment.

Set:

```env
DATA_BACKEND=postgres
AUTH_MODE=database
SIGNUP_MODE=first_user
ALLOW_PREVIEW_AUTH_IN_PRODUCTION=false
AUTH_SECRET=<strong random secret>
INTEGRATION_ENCRYPTION_KEY=<separate strong random secret>
ALLOW_SHARED_ENV_INTEGRATIONS=false
DATABASE_URL=<production postgres connection string>
```

For the initial administrator, temporarily set:

```env
INITIAL_ADMIN_EMAIL=<admin email>
INITIAL_ADMIN_PASSWORD=<12+ character password>
INITIAL_ADMIN_NAME=<admin name>
```

Then run:

```bash
npm run db:deploy
npm run db:seed
```

After the initial admin is created, remove `INITIAL_ADMIN_PASSWORD` from the production environment. The seed creates the platform-admin user and its WorkspaceAccess record. `SIGNUP_MODE=first_user` allows only the first database user; use `SIGNUP_MODE=open` only when public multi-client signup is intentionally enabled.

## 2. Meta / Instagram / Facebook

Create/configure the Meta app and add the production callback URL:

```text
https://<production-domain>/api/integrations/meta/callback
```

Set:

```env
META_APP_ID=<app id>
META_APP_SECRET=<app secret>
META_GRAPH_VERSION=v26.0
```

The portal requests the Page and Instagram publishing permissions needed by the current adapter. Tokens received through OAuth are encrypted before database storage and scoped to the current workspace.

From Social Hub, use **Connect** on Facebook or Instagram, approve the requested account permissions, and return to the portal. The connection selects the first Page with a linked Instagram professional account when one is available.

Supported live Meta formats in the current adapter:

- Facebook: text/link and public-image static posts.
- Instagram: public-image static posts and Reels/video from a public media URL.
- Unsupported formats remain safely queued instead of being marked published.

## 3. LinkedIn

Create/configure a LinkedIn developer app. Enable **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**. Add the production callback URL:

```text
https://<production-domain>/api/integrations/linkedin/callback
```

Set:

```env
LINKEDIN_CLIENT_ID=<client id>
LINKEDIN_CLIENT_SECRET=<client secret>
LINKEDIN_API_VERSION=202608
LINKEDIN_REQUEST_ORGANIZATION_SCOPE=false
```

For member posting the OAuth flow requests `openid profile email w_member_social`.

For organization/Page posting, obtain the required LinkedIn organization publishing access, set:

```env
LINKEDIN_REQUEST_ORGANIZATION_SCOPE=true
LINKEDIN_ORGANIZATION_URN=urn:li:organization:<organization id>
```

and ensure the authenticating member has an allowed Page role.

Supported live LinkedIn formats in the current adapter:

- Text-only posts.
- Article/link posts.
- Media uploads remain queued until the LinkedIn Images/Videos upload adapter is enabled.

## Security defaults

- Database sessions are bound to `userId` and `workspaceId`.
- Database reads/writes are workspace-scoped.
- Integration OAuth tokens are AES-256-GCM encrypted at rest.
- Shared static environment tokens are disabled in PostgreSQL mode unless `ALLOW_SHARED_ENV_INTEGRATIONS=true` is explicitly enabled.
- Unsupported publishing actions remain in the portal queue and are never reported as externally published.


## Scheduler activation

Scheduled social publishing now uses Vercel Workflow DevKit instead of five-minute polling.

When a post is scheduled or rescheduled:

1. The post is saved in PostgreSQL with its exact `scheduledAt`.
2. A durable Workflow run starts and sleeps until that exact delivery time without consuming active compute.
3. On wake, the workflow re-reads the post and only publishes if its status and schedule still match.
4. Rescheduled or cancelled posts make older workflow runs exit safely without publishing.
5. The daily native Vercel Cron remains a reconciliation/recovery fallback.

Set:

```env
DURABLE_SOCIAL_SCHEDULER_ENABLED=true
```

For the optional daily recovery cron, configure a strong `CRON_SECRET`. The former five-minute GitHub Actions scheduler is retained only as a manual endpoint diagnostic because Vercel Deployment Protection currently blocks external automated requests until the project enables a trusted source or protection bypass.

## Production smoke diagnostics

The GitHub Production Smoke workflow is manual-only while Vercel Deployment Protection requires project-side trusted-source configuration. Once Vercel project access is restored, enable either GitHub as a Vercel Trusted Source or a Protection Bypass for Automation, then recurring smoke checks can be re-enabled.
