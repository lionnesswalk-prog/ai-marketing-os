export function canonicalAppOrigin(fallbackOrigin: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const candidate = configured || fallbackOrigin;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported app origin protocol");
    return url.origin;
  } catch {
    return new URL(fallbackOrigin).origin;
  }
}

export function oauthRedirectUri(fallbackOrigin: string, callbackPath: string) {
  return new URL(callbackPath, canonicalAppOrigin(fallbackOrigin)).toString();
}
