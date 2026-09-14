export const PREVIEW_TESTING_MODE = true;

export function previewTestingMode() {
  return PREVIEW_TESTING_MODE;
}

export function shouldUsePostgresRuntime() {
  return !PREVIEW_TESTING_MODE &&
    process.env.AUTH_MODE === "database" &&
    process.env.DATA_BACKEND === "postgres";
}
