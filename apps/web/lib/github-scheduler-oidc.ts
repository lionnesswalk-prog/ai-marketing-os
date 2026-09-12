import { createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = "https://token.actions.githubusercontent.com/.well-known/jwks";
const GITHUB_OIDC_AUDIENCE = "ai-marketing-os-scheduler";
const GITHUB_REPOSITORY = "lionnesswalk-prog/ai-marketing-os";
const GITHUB_MAIN_REF = "refs/heads/main";
const GITHUB_SCHEDULER_WORKFLOW_REF =
  "lionnesswalk-prog/ai-marketing-os/.github/workflows/social-scheduler.yml@refs/heads/main";

type GitHubSchedulerClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type Jwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

let cachedJwks: { expiresAt: number; keys: Jwk[] } | undefined;

function decodeJsonPart<T>(part: string): T | null {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function audienceMatches(aud: GitHubSchedulerClaims["aud"]) {
  if (typeof aud === "string") return aud === GITHUB_OIDC_AUDIENCE;
  return Array.isArray(aud) && aud.includes(GITHUB_OIDC_AUDIENCE);
}

export function validateGitHubSchedulerClaims(
  claims: GitHubSchedulerClaims,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (claims.iss !== GITHUB_OIDC_ISSUER) return false;
  if (!audienceMatches(claims.aud)) return false;
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds - 30) return false;
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 30) return false;
  if (typeof claims.iat === "number" && claims.iat > nowSeconds + 30) return false;
  if (claims.repository !== GITHUB_REPOSITORY) return false;
  if (claims.ref !== GITHUB_MAIN_REF) return false;
  if (claims.workflow_ref !== GITHUB_SCHEDULER_WORKFLOW_REF) return false;
  if (!["schedule", "workflow_dispatch"].includes(claims.event_name || "")) return false;
  return true;
}

async function getGitHubJwk(kid: string) {
  const now = Date.now();
  if (!cachedJwks || cachedJwks.expiresAt <= now) {
    const response = await fetch(GITHUB_OIDC_JWKS, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("GITHUB_OIDC_JWKS_UNAVAILABLE");
    const body = await response.json() as { keys?: Jwk[] };
    cachedJwks = {
      expiresAt: now + 60 * 60_000,
      keys: Array.isArray(body.keys) ? body.keys : [],
    };
  }

  let key = cachedJwks.keys.find((item) => item.kid === kid);
  if (!key) {
    cachedJwks = undefined;
    const response = await fetch(GITHUB_OIDC_JWKS, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("GITHUB_OIDC_JWKS_UNAVAILABLE");
    const body = await response.json() as { keys?: Jwk[] };
    cachedJwks = {
      expiresAt: now + 60 * 60_000,
      keys: Array.isArray(body.keys) ? body.keys : [],
    };
    key = cachedJwks.keys.find((item) => item.kid === kid);
  }
  return key;
}

export async function verifyGitHubSchedulerOidcToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  const claims = decodeJsonPart<GitHubSchedulerClaims>(encodedPayload);
  if (!header || !claims || header.alg !== "RS256" || !header.kid) return false;
  if (!validateGitHubSchedulerClaims(claims)) return false;

  try {
    const jwk = await getGitHubJwk(header.kid);
    if (!jwk || jwk.kty !== "RSA" || !jwk.n || !jwk.e) return false;
    const publicKey = createPublicKey({ key: jwk as any, format: "jwk" });
    return verifySignature(
      "RSA-SHA256",
      Buffer.from(encodedHeader + "." + encodedPayload),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch (error) {
    console.error("github scheduler oidc verification failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export function matchesSchedulerSharedSecret(token: string, secret: string | undefined) {
  if (!secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const schedulerOidcAudience = GITHUB_OIDC_AUDIENCE;
