import { canEncryptIntegrations } from "./integration-crypto";
import { schedulerAuthReady, schedulerExternalEnabled } from "./scheduler-config";

export type RuntimeHealthSnapshot = {
  environment: string;
  commit?: string;
  authMode: string;
  dataBackend: string;
  checks: {
    authSecret: boolean;
    databaseConfigured: boolean;
    integrationEncryption: boolean;
    tenantIsolation: boolean;
    schedulerAuthentication: boolean;
    externalSchedulerDeclared: boolean;
    aiRuntime: boolean;
  };
};

export function getRuntimeHealthSnapshot(): RuntimeHealthSnapshot {
  const authMode = process.env.AUTH_MODE || "preview";
  const dataBackend = process.env.DATA_BACKEND || "memory";
  const databaseRequired = dataBackend === "postgres";
  const authSecretRequired = authMode === "database";

  return {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    authMode,
    dataBackend,
    checks: {
      authSecret: !authSecretRequired || Boolean(process.env.AUTH_SECRET),
      databaseConfigured: !databaseRequired || Boolean(process.env.DATABASE_URL),
      integrationEncryption: canEncryptIntegrations(),
      tenantIsolation: process.env.ALLOW_SHARED_ENV_INTEGRATIONS !== "true",
      schedulerAuthentication: schedulerAuthReady(),
      externalSchedulerDeclared: schedulerExternalEnabled(),
      aiRuntime: process.env.AI_MODE !== "live" || Boolean(process.env.OPENAI_API_KEY),
    },
  };
}
