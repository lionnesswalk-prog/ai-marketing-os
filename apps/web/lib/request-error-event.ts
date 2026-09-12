type RequestLike = {
  path: string;
  method: string;
};

type ContextLike = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
};

function safePath(value: string) {
  const [path] = value.split(/[?#]/, 1);
  return path || "/";
}

export function buildRequestErrorEvent(
  error: { name?: string; digest?: string },
  request: RequestLike,
  context: ContextLike,
) {
  return {
    event: "unhandled_request_error",
    timestamp: new Date().toISOString(),
    digest: error.digest || undefined,
    errorName: error.name || "Error",
    method: request.method,
    path: safePath(request.path),
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
  };
}
