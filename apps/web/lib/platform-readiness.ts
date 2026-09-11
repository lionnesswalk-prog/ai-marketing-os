import { canEncryptIntegrations } from "./integration-crypto";
import { getMetaSetupState } from "./meta-integration";
import { getLinkedInSetupState } from "./linkedin-integration";
import { getXSetupState } from "./x-integration";
import { getTikTokSetupState } from "./tiktok-integration";
import { getYouTubeSetupState } from "./youtube-integration";
import { getPinterestSetupState } from "./pinterest-integration";
import { getBillingSetupState, verifyStripeProductionConfiguration } from "./billing";

export type PlatformCheck = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type ProviderReadiness = {
  id: "meta" | "linkedin" | "x" | "tiktok" | "youtube" | "pinterest";
  name: string;
  short: string;
  ready: boolean;
  appConfigured: boolean;
  storageReady: boolean;
  credentials: string[];
  callbackUrl: string;
  scopes: string[];
  capabilities: string[];
  note: string;
};

function publicOrigin() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return "https://" + vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return "https://ai-marketing-os.vercel.app";
}

function callback(path: string) {
  return publicOrigin() + path;
}

export async function getPlatformReadiness() {
  const meta = getMetaSetupState();
  const linkedin = getLinkedInSetupState();
  const x = getXSetupState();
  const tiktok = getTikTokSetupState();
  const youtube = getYouTubeSetupState();
  const pinterest = getPinterestSetupState();
  const billing = getBillingSetupState();
  const stripe = await verifyStripeProductionConfiguration();

  const checks: PlatformCheck[] = [
    {
      key: "database",
      label: "Production database",
      ready: process.env.DATA_BACKEND === "postgres" && Boolean(process.env.DATABASE_URL),
      detail: "PostgreSQL is required for isolated client workspaces, users and provider connections.",
    },
    {
      key: "auth",
      label: "Database authentication",
      ready: process.env.AUTH_MODE === "database",
      detail: "Production users and workspace access must use database-backed authentication.",
    },
    {
      key: "session-secret",
      label: "Session signing",
      ready: Boolean(process.env.AUTH_SECRET),
      detail: "AUTH_SECRET signs secure application sessions.",
    },
    {
      key: "integration-encryption",
      label: "Token encryption",
      ready: canEncryptIntegrations(),
      detail: "Connected social tokens are encrypted before storage.",
    },
    {
      key: "tenant-fallback",
      label: "Tenant isolation",
      ready: process.env.ALLOW_SHARED_ENV_INTEGRATIONS !== "true",
      detail: "Shared provider tokens stay disabled so one client cannot inherit another client's account.",
    },
    {
      key: "signup",
      label: "Client onboarding",
      ready: (process.env.SIGNUP_MODE || "open") === "open",
      detail: "Open SaaS signup creates a separate workspace and brand for every new client.",
    },
    {
      key: "billing-checkout",
      label: "Stripe Checkout",
      ready: billing.checkoutConfigured,
      detail: "Stripe secret key plus at least one plan Price ID are required before a workspace can start paid checkout.",
    },
    {
      key: "billing-api",
      label: "Stripe account verification",
      ready: stripe.accountReachable && stripe.accountReady,
      detail: stripe.accountDetail,
    },
    {
      key: "billing-live-mode",
      label: "Stripe production mode",
      ready: stripe.modeReady,
      detail: stripe.mode === "live"
        ? "Live Stripe secret key is configured for production."
        : stripe.mode === "test"
          ? "Test-mode Stripe key detected. Replace it with a live key before accepting production payments."
          : "Stripe key mode cannot be verified.",
    },
    {
      key: "billing-plan-prices",
      label: "Stripe plan prices",
      ready: billing.allPlanPricesConfigured,
      detail: billing.configuredPlanCount + "/" + billing.totalPlans + " plan Price IDs are configured for hosted checkout.",
    },
    {
      key: "billing-portal",
      label: "Stripe Customer Portal",
      ready: billing.portalConfigured,
      detail: "The Stripe secret key is required before workspace admins can open hosted billing management.",
    },
    {
      key: "billing-webhook",
      label: "Stripe webhook sync",
      ready: billing.webhookConfigured,
      detail: "STRIPE_WEBHOOK_SECRET verifies subscription lifecycle events before billing state is written to the workspace.",
    },
  ];

  function provider(input: Omit<ProviderReadiness, "ready">): ProviderReadiness {
    return { ...input, ready: input.appConfigured && input.storageReady };
  }

  const providers: ProviderReadiness[] = [
    provider({
      id: "meta",
      name: "Meta · Facebook & Instagram",
      short: "M",
      appConfigured: meta.appConfigured,
      storageReady: meta.storageReady,
      credentials: ["META_APP_ID", "META_APP_SECRET"],
      callbackUrl: callback("/api/integrations/meta/callback"),
      scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
      capabilities: ["Facebook Page connection", "Instagram Professional connection", "Supported direct publishing", "Organic analytics"],
      note: "Graph API " + meta.graphVersion + ". Provider review/business verification is managed in Meta and is not inferred from environment variables.",
    }),
    provider({
      id: "linkedin",
      name: "LinkedIn",
      short: "in",
      appConfigured: linkedin.appConfigured,
      storageReady: linkedin.storageReady,
      credentials: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
      callbackUrl: callback("/api/integrations/linkedin/callback"),
      scopes: ["openid", "profile", "email", "w_member_social"],
      capabilities: ["Member OAuth", "Text publishing", "Article-link publishing", "Workspace-scoped connection"],
      note: "API version " + linkedin.apiVersion + ". Organization publishing and post analytics can require additional LinkedIn products.",
    }),
    provider({
      id: "x",
      name: "X",
      short: "X",
      appConfigured: x.appConfigured,
      storageReady: x.storageReady,
      credentials: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
      callbackUrl: callback("/api/integrations/x/callback"),
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      capabilities: ["OAuth 2.0 PKCE", "Text/link publishing", "Token refresh", "Public post analytics"],
      note: "Media upload remains outside the current direct text/link publishing adapter.",
    }),
    provider({
      id: "tiktok",
      name: "TikTok",
      short: "TT",
      appConfigured: tiktok.appConfigured,
      storageReady: tiktok.storageReady,
      credentials: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
      callbackUrl: callback("/api/integrations/tiktok/callback"),
      scopes: ["user.info.basic", "user.info.stats", "video.list", "video.publish"],
      capabilities: ["Creator connection", "Direct video submission", "Privacy selection", "Processing status", "Analytics"],
      note: "Broader public posting depends on the TikTok developer app approval/audit and media URL requirements.",
    }),
    provider({
      id: "youtube",
      name: "YouTube",
      short: "YT",
      appConfigured: youtube.appConfigured,
      storageReady: youtube.storageReady,
      credentials: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
      callbackUrl: callback("/api/integrations/youtube/callback"),
      scopes: ["youtube.upload", "youtube.readonly"],
      capabilities: ["Channel connection", "Video/Short upload", "Privacy control", "Processing status", "Channel/video analytics"],
      note: "Google OAuth consent configuration and YouTube Data API access are managed in the Google Cloud project.",
    }),
    provider({
      id: "pinterest",
      name: "Pinterest",
      short: "P",
      appConfigured: pinterest.appConfigured,
      storageReady: pinterest.storageReady,
      credentials: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
      callbackUrl: callback("/api/integrations/pinterest/callback"),
      scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
      capabilities: ["Account connection", "Board selection", "Direct image Pin publishing", "Organic Pin analytics"],
      note: "Video Pin upload stays out of the live path until the media-upload adapter is enabled.",
    }),
  ];

  const readyChecks = checks.filter((item) => item.ready).length;
  const readyProviders = providers.filter((item) => item.ready).length;

  return {
    origin: publicOrigin(),
    checks,
    providers,
    stripe,
    summary: {
      runtimeReady: readyChecks === checks.length,
      readyChecks,
      totalChecks: checks.length,
      readyProviders,
      totalProviders: providers.length,
      blockers: checks.filter((item) => !item.ready).length + providers.filter((item) => !item.ready).length,
    },
  };
}
