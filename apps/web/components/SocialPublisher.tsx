"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SocialPlatform, SocialContentType } from "../lib/domain";
import type { SocialPlatformConfig } from "../lib/social-platforms";

type TikTokCreatorInfo = {
  creatorUsername?: string;
  creatorNickname?: string;
  privacyLevelOptions: string[];
};

const privacyLabels: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Public",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

export function SocialPublisher({ platforms }: { platforms: SocialPlatformConfig[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SocialPlatform[]>(["instagram", "facebook"]);
  const [title, setTitle] = useState("New social post");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [contentType, setContentType] = useState<SocialContentType>("static");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tiktokCreator, setTikTokCreator] = useState<TikTokCreatorInfo | null>(null);
  const [tiktokPrivacyLevel, setTikTokPrivacyLevel] = useState("");
  const [tiktokLoading, setTikTokLoading] = useState(false);

  const selectedConfigs = useMemo(() => platforms.filter((item) => selected.includes(item.id)), [platforms, selected]);
  const allConnected = selectedConfigs.length > 0 && selectedConfigs.every((item) => item.connected);
  const tiktokConnected = Boolean(platforms.find((item) => item.id === "tiktok")?.connected);
  const tiktokSelected = selected.includes("tiktok");

  useEffect(() => {
    if (!tiktokSelected || !tiktokConnected) {
      setTikTokCreator(null);
      setTikTokPrivacyLevel("");
      return;
    }

    const controller = new AbortController();
    setTikTokLoading(true);
    fetch("/api/integrations/tiktok/creator-info", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load TikTok creator settings.");
        return body.creator as TikTokCreatorInfo;
      })
      .then((creator) => {
        setTikTokCreator(creator);
        setTikTokPrivacyLevel((current) => creator.privacyLevelOptions.includes(current) ? current : "");
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setTikTokCreator(null);
        setTikTokPrivacyLevel("");
        setError(err instanceof Error ? err.message : "Unable to load TikTok creator settings.");
      })
      .finally(() => setTikTokLoading(false));

    return () => controller.abort();
  }, [tiktokConnected, tiktokSelected]);

  function togglePlatform(platform: SocialPlatform) {
    setSelected((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  }

  async function submit(action: "draft" | "schedule" | "publish") {
    if (action === "publish" && tiktokSelected && tiktokConnected && !tiktokPrivacyLevel) {
      setError("Choose a TikTok privacy level before publishing.");
      return;
    }

    setBusy(action);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platforms: selected,
          title,
          caption,
          hashtags,
          cta,
          mediaUrl,
          linkUrl,
          altText,
          contentType,
          tiktokPrivacyLevel: tiktokPrivacyLevel || undefined,
          scheduledAt: scheduledAt || undefined,
          action,
        }),
      });
      const body = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(body.error ?? "Unable to save post.");
      setMessage(body.message ?? "Post saved.");
      if (body.warning) setError(body.warning);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save post.");
    } finally {
      setBusy(null);
    }
  }

  function preventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="social-hub-grid">
      <section className="card social-connect-card">
        <div className="social-section-head">
          <div><p className="eyebrow">CONNECTED CHANNELS</p><h2>Social accounts</h2></div>
          <span className="pill">{platforms.filter((item) => item.connected).length}/{platforms.length} connected</span>
        </div>
        <div className="social-platform-grid">
          {platforms.map((platform) => (
            <article className={`social-platform ${platform.connected ? "connected" : ""}`} key={platform.id}>
              <div className="social-platform-mark">{platform.short}</div>
              <div className="social-platform-copy">
                <strong>{platform.name}</strong>
                <span>{platform.connected ? (platform.accountLabel || "API connected") : platform.setupReady === false && platform.connectUrl ? "Setup required" : "Connection required"}</span>
              </div>
              <div className="social-platform-actions">
                <a href={platform.homeUrl} target="_blank" rel="noreferrer">Open ↗</a>
                {!platform.connected && platform.connectUrl && <a className="connect-social" href={platform.connectUrl}>Connect</a>}
                {platform.connected && platform.disconnectUrl && (
                  <form action={platform.disconnectUrl} method="post"><button type="submit">Disconnect</button></form>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="social-help">Meta, LinkedIn, X and TikTok have secure OAuth connection flows. YouTube and Pinterest remain in queue mode until their adapters are enabled.</p>
      </section>

      <form className="card social-composer" onSubmit={preventSubmit}>
        <div className="social-section-head">
          <div><p className="eyebrow">PUBLISHER</p><h2>Create one post, send everywhere</h2></div>
          <span className={`pill ${allConnected ? "accent" : ""}`}>{allConnected ? "Ready to publish" : "Queue mode"}</span>
        </div>

        <label>Platforms</label>
        <div className="platform-picker">
          {platforms.map((platform) => (
            <button className={selected.includes(platform.id) ? "selected" : ""} type="button" key={platform.id} onClick={() => togglePlatform(platform.id)}>
              <span>{platform.short}</span>{platform.name}
            </button>
          ))}
        </div>

        <div className="social-form-grid">
          <label>Post title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
          <label>Format<select value={contentType} onChange={(e) => setContentType(e.target.value as SocialContentType)}><option value="static">Static</option><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="story">Story</option><option value="video">Video</option><option value="short">Short</option></select></label>
        </div>

        <label>Caption<textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write or paste the final caption..." /></label>
        <div className="social-form-grid">
          <label>Hashtags<input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#lionesswalk #quietluxury" /></label>
          <label>CTA<input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Discover the collection" /></label>
        </div>
        <div className="social-form-grid">
          <label>Media URL<input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://... image or video" /></label>
          <label>Destination link<input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://lionesswalk.com/..." /></label>
        </div>

        {tiktokSelected && tiktokConnected && (
          <div className="social-form-grid">
            <label>
              TikTok privacy
              <select value={tiktokPrivacyLevel} onChange={(e) => setTikTokPrivacyLevel(e.target.value)} disabled={tiktokLoading}>
                <option value="">{tiktokLoading ? "Loading creator settings..." : "Choose privacy"}</option>
                {(tiktokCreator?.privacyLevelOptions ?? []).map((level) => <option key={level} value={level}>{privacyLabels[level] ?? level}</option>)}
              </select>
            </label>
            <label>
              TikTok creator
              <input value={tiktokCreator?.creatorNickname || tiktokCreator?.creatorUsername || "Connected creator"} readOnly aria-readonly="true" />
            </label>
          </div>
        )}

        <label>Alt text<input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image for accessibility" /></label>
        <label>Schedule time<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>

        {message && <div className="profile-notice success">{message}</div>}
        {error && <div className="profile-notice error">{error}</div>}

        <div className="social-actions">
          <button className="btn secondary" type="button" disabled={busy !== null || selected.length === 0} onClick={() => submit("draft")}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
          <button className="btn secondary" type="button" disabled={busy !== null || selected.length === 0 || !scheduledAt} onClick={() => submit("schedule")}>{busy === "schedule" ? "Scheduling…" : "Schedule"}</button>
          <button className="btn" type="button" disabled={busy !== null || selected.length === 0 || (tiktokSelected && tiktokConnected && (tiktokLoading || !tiktokPrivacyLevel))} onClick={() => submit("publish")}>{busy === "publish" ? "Publishing…" : "Publish now"}</button>
        </div>
      </form>
    </div>
  );
}
