import { getSession } from "../../../../../lib/auth";
import { saveMetaSettings } from "../../../../../lib/platform-meta-settings";
import { handleMetaSettingsSave } from "../../../../../lib/platform-meta-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleMetaSettingsSave(request, { getSession, save: saveMetaSettings });
}
