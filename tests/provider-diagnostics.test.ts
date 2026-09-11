import assert from "node:assert/strict";
import { providerDiagnosticErrorDetail } from "../apps/web/lib/provider-diagnostics";

assert.equal(
  providerDiagnosticErrorDetail(new Error("PROVIDER_DIAGNOSTIC_TIMEOUT")),
  "Provider API did not respond within 10 seconds.",
);
assert.equal(
  providerDiagnosticErrorDetail(new Error("secret provider message")),
  "Provider API rejected or could not verify the saved connection. Reconnect the account or review provider permissions.",
);

console.log("provider diagnostic tests passed");
