export function schedulerBatchSize() {
  const value = Number(process.env.SCHEDULER_BATCH_SIZE || "5");
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(Math.floor(value), 20));
}

export function schedulerCadenceLabel() {
  return "GitHub Actions OIDC scheduler · every 5 min";
}

export function schedulerExternalEnabled() {
  return true;
}

export function schedulerSharedSecretReady() {
  return Boolean(process.env.CRON_SECRET);
}

export function schedulerOidcReady() {
  return true;
}

export function schedulerAuthReady() {
  return schedulerOidcReady() || schedulerSharedSecretReady();
}
