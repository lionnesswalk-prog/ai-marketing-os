export function schedulerBatchSize() {
  const value = Number(process.env.SCHEDULER_BATCH_SIZE || "5");
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(Math.floor(value), 20));
}

export function schedulerCadenceLabel() {
  return "Durable exact-time delivery · daily Vercel recovery";
}

export function schedulerDurableEnabled() {
  return process.env.DURABLE_SOCIAL_SCHEDULER_ENABLED !== "false";
}

export function schedulerExternalEnabled() {
  return schedulerDurableEnabled();
}

export function schedulerSharedSecretReady() {
  return Boolean(process.env.CRON_SECRET);
}

export function schedulerOidcReady() {
  return process.env.GITHUB_SCHEDULER_OIDC_ENABLED !== "false";
}

export function schedulerAuthReady() {
  return schedulerDurableEnabled();
}
