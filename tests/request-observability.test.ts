import assert from "node:assert/strict";
import { buildRequestErrorEvent } from "../apps/web/lib/request-error-event";

const event = buildRequestErrorEvent(
  { name: "Error", digest: "digest_123" },
  {
    method: "POST",
    path: "/api/social/publish?email=private@example.com&token=secret",
  },
  {
    routerKind: "App Router",
    routePath: "/api/social/publish",
    routeType: "route",
  },
);

assert.equal(event.event, "unhandled_request_error");
assert.equal(event.digest, "digest_123");
assert.equal(event.method, "POST");
assert.equal(event.path, "/api/social/publish");
assert.equal(event.routePath, "/api/social/publish");
assert.equal(JSON.stringify(event).includes("private@example.com"), false);
assert.equal(JSON.stringify(event).includes("secret"), false);

console.log("request observability tests passed");
