"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type CreativeTemplate = "editorial" | "split" | "minimal";

type BrandAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: string;
};

type GeneratedDraft = {
  postId: string;
  mediaUrl: string;
  variantUrls: Record<CreativeTemplate, string>;
  creativeTemplate: CreativeTemplate;
  assetId?: string;
  platform: "instagram" | "facebook" | "pinterest";
  title: string;
  subheadline: string;
  caption: string;
  hashtags: string;
  cta: string;
  postingWindow: "morning" | "midday" | "evening";
  suggestedDayOffset: number;
  timingReason: string;
  visualDirection: string;
  pinterestBoardId?: string;
};

type PinterestBoard = {
  id: string;
  name: string;
  privacy?: string;
};

const templateLabels: Record<CreativeTemplate, string> = {
  editorial: "Editorial",
  split: "Split",
  minimal: "Minimal",
};

function suggestedDate(window: GeneratedDraft["postingWindow"], dayOffset: number) {
  const hour = window === "morning" ? 9 : window === "midday" ? 13 : 19;
  const now = new Date();
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setDate(target.getDate() + Math.max(0, Math.min(dayOffset, 6)));
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

function platformLabel(platform: GeneratedDraft["platform"]) {
  if (platform === "instagram") return "Instagram";
  if (platform === "facebook") return "Facebook";
  return "Pinterest";
}

export function BrandStudio({
  brandName,
  logoReady,
  canGenerate,
  initialAssets,
}: {
  brandName: string;
  logoReady: boolean;
  canGenerate: boolean;
  initialAssets: BrandAsset[];
}) {
  const [theme, setTheme] = useState("");
  const [objective, setObjective] = useState("");
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState<"" | "instagram" | "facebook" | "pinterest">("");
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [busy, setBusy] = useState<"upload" | "generate" | "save" | "publish" | "schedule" | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const schedule = useMemo(
    () => draft ? suggestedDate(draft.postingWindow, draft.suggestedDayOffset) : null,
    [draft],
  );

  useEffect(() => {
    if (draft?.platform !== "pinterest") {
      setBoards([]);
      return;
    }

    const controller = new AbortController();
    setBoardsLoading(true);
    fetch("/api/integrations/pinterest/boards", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Connect Pinterest before selecting a board.");
        return body.boards as PinterestBoard[];
      })
      .then((items) => setBoards(items))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setBoards([]);
        setWarning(err instanceof Error ? err.message : "Pinterest board list is unavailable.");
      })
      .finally(() => setBoardsLoading(false));

    return () => controller.abort();
  }, [draft?.platform]);

  function edit<K extends keyof GeneratedDraft>(key: K, value: GeneratedDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function selectTemplate(template: CreativeTemplate) {
    setDraft((current) => current
      ? {
          ...current,
          creativeTemplate: template,
          mediaUrl: current.variantUrls[template],
        }
      : current);
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError("Use a JPG, PNG or WebP image up to 6 MB.");
      return;
    }

    setBusy("upload");
    setMessage("");
    setWarning("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/brand-assets", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to upload this product image.");
      const asset = body.asset as BrandAsset;
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)].slice(0, 12));
      setSelectedAssetId(asset.id);
      setMessage("Product image uploaded and selected for the next creative.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload this product image.");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!canGenerate) return;
    setBusy("generate");
    setMessage("");
    setWarning("");
    setError("");
    try {
      const response = await fetch("/api/brand-studio/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme,
          objective,
          product: product || undefined,
          preferredPlatform: platform || undefined,
          assetId: selectedAssetId || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to generate branded post.");
      setDraft(body.draft);
      setDirty(false);
      setWarning(body.warning || (body.mode === "mock" ? "Safe built-in creative mode is active." : ""));
      setMessage(selectedAssetId
        ? "Three product-led branded creative options generated and saved as one Social Hub draft."
        : "Three branded layout options generated and saved as one Social Hub draft.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate branded post.");
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy("save");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/brand-studio/draft", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postId: draft.postId,
          headline: draft.title,
          subheadline: draft.subheadline,
          caption: draft.caption,
          cta: draft.cta,
          hashtags: draft.hashtags,
          pinterestBoardId: draft.pinterestBoardId || undefined,
          creativeTemplate: draft.creativeTemplate,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save Brand Studio changes.");
      setDraft((current) => current ? { ...current, ...body.draft } : current);
      setDirty(false);
      setMessage("Changes saved. All three creative options were regenerated with fresh secure image URLs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save Brand Studio changes.");
    } finally {
      setBusy(null);
    }
  }

  async function postAction(action: "publish" | "reschedule") {
    if (!draft) return;
    if (dirty) {
      setError("Save your Brand Studio edits and template choice before publishing or scheduling.");
      return;
    }
    if (draft.platform === "pinterest" && !draft.pinterestBoardId) {
      setError("Choose and save a Pinterest board before publishing or scheduling.");
      return;
    }

    setBusy(action === "publish" ? "publish" : "schedule");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/social/posts/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "publish"
          ? { action: "publish", postId: draft.postId }
          : { action: "reschedule", postId: draft.postId, scheduledAt: schedule?.toISOString() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update this post.");
      setMessage(body.message || "Post updated.");
      if (body.warning) setWarning(body.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this post.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="studio-grid">
      <div className="card studio-builder">
        <div className="section-head top-align">
          <div>
            <p className="eyebrow">AI CREATIVE BUILDER</p>
            <h2>Generate a branded post</h2>
            <p className="muted">Upload a product or garment photo, then combine it with {brandName}&apos;s saved logo, colors and AI-written campaign copy.</p>
          </div>
          <span className={"pill " + (logoReady ? "accent" : "")}>{logoReady ? "Logo ready" : "Wordmark mode"}</span>
        </div>

        {!logoReady && (
          <div className="profile-notice">
            Add a public logo URL in Brand Profile for logo-based creatives. Until then, Brand Studio uses the brand name as a clean wordmark.
          </div>
        )}

        <div className="studio-asset-head">
          <div>
            <p className="eyebrow">PRODUCT / GARMENT IMAGE</p>
            <p className="muted">JPG, PNG or WebP · max 6 MB. Uploads stay inside this workspace.</p>
          </div>
          <label className="btn secondary studio-upload-button">
            {busy === "upload" ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canGenerate || busy !== null} onChange={uploadAsset} />
          </label>
        </div>

        <div className="studio-assets">
          <button
            className={"studio-asset " + (!selectedAssetId ? "selected" : "")}
            type="button"
            onClick={() => setSelectedAssetId("")}
          >
            <span className="studio-asset-none">AI</span>
            <small>No product photo</small>
          </button>
          {assets.map((asset) => (
            <button
              className={"studio-asset " + (selectedAssetId === asset.id ? "selected" : "")}
              type="button"
              key={asset.id}
              onClick={() => setSelectedAssetId(asset.id)}
              title={asset.fileName}
            >
              <img src={"/api/brand-assets/" + asset.id} alt={asset.fileName} />
              <small>{asset.fileName}</small>
            </button>
          ))}
        </div>

        <label>Post theme
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="New collection, product story, event, service, seasonal campaign..." />
        </label>
        <label>Objective
          <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Build awareness, drive discovery, generate inquiries..." />
        </label>
        <div className="studio-form-grid">
          <label>Product / offer · optional
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Specific product, service or campaign" />
          </label>
          <label>Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
              <option value="">Let AI choose</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="pinterest">Pinterest</option>
            </select>
          </label>
        </div>

        <button className="btn" type="button" disabled={!canGenerate || busy !== null || theme.trim().length < 3 || objective.trim().length < 3} onClick={generate}>
          {busy === "generate" ? "Generating 3 options…" : "Generate 3 creative options"}
        </button>
        {!canGenerate && <p className="muted">Read-only access · ask an Admin or Marketing Manager to generate and publish creatives.</p>}
      </div>

      <div className="card studio-preview">
        <div className="section-head">
          <div><p className="eyebrow">READY CREATIVE</p><h2>{draft ? draft.title : "Preview"}</h2></div>
          {draft && <span className="pill accent">{platformLabel(draft.platform)}</span>}
        </div>

        {draft ? (
          <>
            <div className="studio-image-frame"><img key={draft.mediaUrl} src={draft.mediaUrl} alt={draft.title} /></div>

            <div className="studio-variants">
              {(Object.keys(templateLabels) as CreativeTemplate[]).map((template) => (
                <button
                  type="button"
                  className={"studio-variant " + (draft.creativeTemplate === template ? "selected" : "")}
                  key={template}
                  onClick={() => selectTemplate(template)}
                >
                  <img src={draft.variantUrls[template]} alt={templateLabels[template] + " creative option"} />
                  <span>{templateLabels[template]}</span>
                </button>
              ))}
            </div>

            <div className="studio-editor">
              <div className="studio-form-grid">
                <label>Headline
                  <input value={draft.title} maxLength={80} onChange={(e) => edit("title", e.target.value)} />
                </label>
                <label>CTA
                  <input value={draft.cta} maxLength={80} onChange={(e) => edit("cta", e.target.value)} />
                </label>
              </div>
              <label>Supporting line
                <input value={draft.subheadline} maxLength={160} onChange={(e) => edit("subheadline", e.target.value)} />
              </label>
              <label>Caption
                <textarea rows={5} value={draft.caption} maxLength={2200} onChange={(e) => edit("caption", e.target.value)} />
              </label>
              <label>Hashtags
                <input value={draft.hashtags} maxLength={1000} onChange={(e) => edit("hashtags", e.target.value)} />
              </label>

              {draft.platform === "pinterest" && (
                <label>Pinterest board
                  <select
                    value={draft.pinterestBoardId || ""}
                    disabled={boardsLoading}
                    onChange={(e) => edit("pinterestBoardId", e.target.value)}
                  >
                    <option value="">{boardsLoading ? "Loading boards..." : "Choose board"}</option>
                    {boards.map((board) => (
                      <option key={board.id} value={board.id}>
                        {board.name}{board.privacy ? " · " + board.privacy.toLowerCase() : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button className="btn secondary" type="button" disabled={!dirty || busy !== null || draft.title.trim().length < 1} onClick={saveDraft}>
                {busy === "save" ? "Saving & regenerating…" : dirty ? "Save selection & edits" : "Creative saved"}
              </button>
              {dirty && <p className="muted">Save the selected layout and copy before publishing so the Social Hub draft uses exactly this version.</p>}
            </div>

            <div className="studio-timing">
              <div><span>AI timing suggestion</span><strong>{schedule?.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong></div>
              <p>{draft.timingReason}</p>
            </div>
            <div className="studio-actions">
              <button className="btn" type="button" disabled={busy !== null || dirty} onClick={() => postAction("publish")}>{busy === "publish" ? "Publishing…" : "Publish now"}</button>
              <button className="btn secondary" type="button" disabled={busy !== null || !schedule || dirty} onClick={() => postAction("reschedule")}>{busy === "schedule" ? "Scheduling…" : "Schedule AI time"}</button>
              <a className="text-link" href="/social">Open Social Hub →</a>
            </div>
          </>
        ) : (
          <div className="studio-empty">
            <div className="studio-placeholder-orb" />
            <h3>Your product-led creative options will appear here.</h3>
            <p className="muted">Upload a garment or product photo for product-led layouts, or generate without one for logo-and-color brand creatives.</p>
          </div>
        )}

        {message && <div className="profile-notice success">{message}</div>}
        {warning && <div className="profile-notice">{warning}</div>}
        {error && <div className="profile-notice error">{error}</div>}
      </div>
    </section>
  );
}
