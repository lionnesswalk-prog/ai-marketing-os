export type RuntimeAuthMode = "database" | "preview";
export type RuntimeDataBackend = "postgres" | "memory";

export function runtimeEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
}

export function effectiveAuthMode(): RuntimeAuthMode {
  if (process.env.AUTH_MODE === "database") return "database";
  if (runtimeEnvironment() === "production" && process.env.ALLOW_PREVIEW_AUTH_IN_PRODUCTION !== "true") {
    return "database";
  }
  return "preview";
}

export function effectiveDataBackend(): RuntimeDataBackend {
  if (process.env.DATA_BACKEND === "postgres") return "postgres";
  if (process.env.DATA_BACKEND === "memory") return "memory";
  return runtimeEnvironment() === "production" ? "postgres" : "memory";
}

export function isPostgresBackend() {
  return effectiveDataBackend() === "postgres";
}

export function isDatabaseMode() {
  return effectiveAuthMode() === "database" && effectiveDataBackend() === "postgres";
}
