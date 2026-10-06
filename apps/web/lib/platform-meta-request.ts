import type { AppSession } from "./auth";
import type { MetaSettingsView } from "./platform-meta-settings";

type Dependencies = {
  getSession: () => Promise<AppSession | null>;
  save: (session: AppSession, input: unknown) => Promise<MetaSettingsView>;
};

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleMetaSettingsSave(request: Request, dependencies: Dependencies) {
  const session = await dependencies.getSession();
  if (!session) return json({ error: "Sign in to continue." }, 401);
  if (!session.platformAdmin) return json({ error: "Platform administrator access required." }, 403);

  // Credentials may only be changed by a same-origin browser request.
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "Reload this page before saving your settings." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return json({ error: "Send settings as JSON." }, 415);
  }
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Settings are too large." }, 413);

  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 4096) return json({ error: "Settings are too large." }, 413);
    let input: unknown;
    try { input = JSON.parse(text); } catch { return json({ error: "Enter valid Meta app settings." }, 400); }
    const settings = await dependencies.save(session, input);
    return json({ ok: true, settings, message: "Meta settings saved. You can now connect an account from Connections." });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const errors: Record<string, [number, string]> = {
      PLATFORM_ADMIN_REQUIRED: [403, "Platform administrator access required."],
      META_SETTINGS_INVALID: [400, "Enter a numeric App ID and a valid App Secret."],
      META_SETTINGS_SECRET_REQUIRED: [400, "Enter the App Secret for this App ID. Leave it blank only to keep the secret for the same app."],
      META_SETTINGS_CONFLICT: [409, "These settings changed in another session. Reload the page before saving again."],
      META_SETTINGS_STORAGE_REQUIRED: [503, "Secure database storage must be enabled before saving app credentials."],
    };
    const [status, message] = errors[code] || [503, "Meta settings could not be saved. Please try again."];
    // Raw errors may contain database parameters or secrets. Never return or log them.
    return json({ error: message }, status);
  }
}
