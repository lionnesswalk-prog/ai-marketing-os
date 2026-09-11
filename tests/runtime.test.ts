import assert from "node:assert/strict";
import { canonicalAppOrigin, oauthRedirectUri } from "../apps/web/lib/app-origin";

const previous = process.env.NEXT_PUBLIC_APP_URL;

try {
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(canonicalAppOrigin("https://preview.example.com/path"), "https://preview.example.com");
  assert.equal(
    oauthRedirectUri("https://preview.example.com", "/api/integrations/meta/callback"),
    "https://preview.example.com/api/integrations/meta/callback",
  );

  process.env.NEXT_PUBLIC_APP_URL = "https://marketing.example.com/";
  assert.equal(canonicalAppOrigin("https://preview.example.com"), "https://marketing.example.com");
  assert.equal(
    oauthRedirectUri("https://preview.example.com", "/api/integrations/x/callback"),
    "https://marketing.example.com/api/integrations/x/callback",
  );

  process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
  assert.equal(canonicalAppOrigin("https://preview.example.com"), "https://preview.example.com");
} finally {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previous;
}

console.log("runtime tests passed");
