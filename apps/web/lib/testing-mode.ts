export function previewTestingMode() {
  if (process.env.PREVIEW_TESTING_MODE === "true") return true;
  if (process.env.PREVIEW_TESTING_MODE === "false") return false;
  return process.env.VERCEL_ENV === "production";
}

export function shouldUsePostgresRuntime() {
  return !previewTestingMode() &&
    process.env.AUTH_MODE === "database" &&
    process.env.DATA_BACKEND === "postgres";
}
