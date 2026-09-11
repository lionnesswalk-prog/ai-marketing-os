export function schedulerBatchSize() {
  const value = Number(process.env.SCHEDULER_BATCH_SIZE || "5");
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(Math.floor(value), 20));
}

export function schedulerCadenceLabel() {
  const externalMinutes = Number(process.env.SCHEDULER_EXTERNAL_INTERVAL_MINUTES || "0");
  if (Number.isFinite(externalMinutes) && externalMinutes >= 1) {
    return "External scheduler · every " + Math.floor(externalMinutes) + " min";
  }
  return "Daily Vercel cron · 5-min external workflow available";
}

export function schedulerExternalEnabled() {
  const minutes = Number(process.env.SCHEDULER_EXTERNAL_INTERVAL_MINUTES || "0");
  return Number.isFinite(minutes) && minutes >= 1;
}

export function schedulerAuthReady() {
  return Boolean(process.env.CRON_SECRET);
}
