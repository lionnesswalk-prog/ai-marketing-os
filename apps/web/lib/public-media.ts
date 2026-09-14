import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) return true;
  if (normalized.startsWith("::ffff:")) return privateIpv4(normalized.slice("::ffff:".length));
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  return false;
}

async function validatePublicUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("MEDIA_URL_PROTOCOL_NOT_ALLOWED");
  if (url.username || url.password) throw new Error("MEDIA_URL_CREDENTIALS_NOT_ALLOWED");

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("MEDIA_URL_PRIVATE_NETWORK_BLOCKED");

  if (isIP(host)) {
    if (isPrivateNetworkAddress(host)) throw new Error("MEDIA_URL_PRIVATE_NETWORK_BLOCKED");
    return url;
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateNetworkAddress(item.address))) {
    throw new Error("MEDIA_URL_PRIVATE_NETWORK_BLOCKED");
  }
  return url;
}

export async function fetchPublicMedia(value: string, init: RequestInit = {}) {
  let current = await validatePublicUrl(value);

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get("location");
    if (!location || redirectCount === 3) throw new Error("MEDIA_URL_REDIRECT_NOT_ALLOWED");
    current = await validatePublicUrl(new URL(location, current).toString());
  }

  throw new Error("MEDIA_URL_REDIRECT_NOT_ALLOWED");
}
