export function previewTestingMode() {
  return process.env.VERCEL_ENV === "production" || process.env.PREVIEW_TESTING_MODE === "true";
}

export function shouldUsePostgresRuntime() {
  return !previewTestingMode() &&
    process.env.AUTH_MODE === "database" &&
    process.env.DATA_BACKEND === "postgres";
}
