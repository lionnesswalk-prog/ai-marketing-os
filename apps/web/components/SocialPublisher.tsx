"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SocialPlatform, SocialContentType } from "../lib/domain";
import type { SocialPlatformConfig } from "../lib/social-platforms";
import { getSocialDeliveryIssues } from "../lib/social-preflight";

type PinterestBoard = { id: string; name: string; privacy?: string };

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

export function SocialPublisher({ platforms, canManage = true }: { platforms: SocialPlatformConfig[]; canManage?: boolean }) {
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
  const [youtubePrivacyStatus, setYouTubePrivacyStatus] = useState<"public" | "private" | "unlisted">("private");
  const [youtubeMadeForKids, setYouTubeMadeForKids] = useState(false);
  const [pinterestBoards, setPinterestBoards] = useState<PinterestBoard[]>([]);
  const [pinterestBoardId, setPinterestBoardId] = useState("");
  const [pinterestLoading, setPinterestLoading] = useState(false);

  const selectedConfigs = useMemo(() => platforms.filter((item) => selected.includes(item.id)), [platforms, selected]);
  const allConnected = selectedConfigs.length > 0 && selectedConfigs.every((item) => item.connected);
  const tiktokConnected = Boolean(platforms.find((item) => item.id === "tiktok")?.connected);
  const tiktokSelected = selected.includes("tiktok");
  const youtubeConnected = Boolean(platforms.find((item) => item.id === "youtube")?.connected);
  const youtubeSelected = selected.includes("youtube");
  const pinterestConnected = Boolean(platforms.find((item) => item.id === "pinterest")?.connected);
  const pinterestSelected = selected.includes("pinterest");

  const deliveryIssues = useMemo(() => selected.flatMap((channel) => getSocialDeliveryIssues({
    platform: channel,
    contentType,
    caption,
    hashtags,
    cta,
    mediaUrl: mediaUrl || undefined,
    linkUrl: linkUrl || undefined,
    tiktokPrivacyLevel: tiktokPrivacyLevel || undefined,
    youtubePrivacyStatus: youtubePrivacyStatus,
    pinterestBoardId: pinterestBoardId || undefined,
  })), [
    selected,
    contentType,
    caption,
    hashtags,
    cta,
    mediaUrl,
    linkUrl,
    tiktokPrivacyLevel,
    youtubePrivacyStatus,
    pinterestBoardId,
  ]);

  const connectionIssues = selectedConfigs.filter((item) => !item.connected || item.connectionCheckFailed);
  const scheduleReady = selected.length > 0 && deliveryIssues.length === 0 && connectionIssues.length === 0;
  const publishWillQueue = deliveryIssues.length > 0 || connectionIssues.length > 0;

  useEffect(() => {
    if (!pinterestSelected || !pinterestConnected) {
      setPinterestBoards([]);
      setPinterestBoardId("");
      return;
    }

    const controller = new AbortController();
    setPinterestLoading(true);
    fetch("/api/integrations/pinterest/boards", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load Pinterest boards.");
        return body.boards as PinterestBoard[];
      })
      .then((boards) => {
        setPinterestBoards(boards);
        setPinterestBoardId((current) => boards.some((board) => board.id === current) ? current : "");
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setPinterestBoards([]);
        setPinterestBoardId("");
        setError(err instanceof Error ? err.message : "Unable to load Pinterest boards.");
      })
      .finally(() => setPinterestLoading(false));

    return () => controller.abort();
  }, [pinterestConnected, pinterestSelected]);

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
    if (!canManage) return;
    setSelected((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  }

  async function submit(action: "draft" | "schedule" | "publish") {
    if (!canManage) {
      setError("Your workspace role has read-only social access.");
      return;
    }
    if ((action === "publish" || action === "schedule") && tiktokSelected && tiktokConnected && !tiktokPrivacyLevel) {
      setError("Choose a TikTok privacy level before publishing.");
      return;
    }
    if ((action === "publish" || action === "schedule") && pinterestSelected && pinterestConnected && !pinterestBoardId) {
      setError("Choose a Pinterest board before publishing or scheduling.");
      return;
    }
    if (action === "schedule" && !scheduleReady) {
      const issueText = deliveryIssues.map((item) => item.message).join(" ");
      const connectionText = connectionIssues.length
        ? "Connect and verify " + connectionIssues.map((item) => item.name).join(", ") + " before scheduling."
        : "";
      setError([issueText, connectionText].filter(Boolean).join(" "));
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
          youtubePrivacyStatus: youtubePrivacyStatus,
          youtubeMadeForKids,
          pinterestBoardId: pinterestBoardId || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
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
                <span>{platform.connected ? (platform.accountLabel || "API connected") : platform.setupReady === false && platform.connectUrl ? "Platform setup pending" : "Connection required"}</span>
              </div>
              <div className="social-platform-actions">
                <a href={platform.homeUrl} target="_blank" rel="noreferrer">Open ↗</a>
                {canManage && !platform.connected && platform.connectUrl && platform.setupReady !== false && <a className="connect-social" href={platform.connectUrl}>Connect</a>}
                {canManage && !platform.connected && platform.setupReady === false && <button type="button" disabled title="Platform administrator must finish provider setup first.">Setup pending</button>}
                {canManage && platform.connected && platform.disconnectUrl && (
                  <form action={platform.disconnectUrl} method="post"><button type="submit">Disconnect</button></form>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="social-help">Meta, LinkedIn, X, TikTok, YouTube and Pinterest have secure OAuth connection flows. Pinterest image Pins can publish directly to a selected board; video Pins remain queued until media upload support is enabled.</p>
        {!canManage && <div className="profile-notice social-notice">Read-only social access · ask a workspace admin or marketing manager to connect accounts or publish content.</div>}
      </section>

      <form className="card social-composer" onSubmit={preventSubmit}>
        <div className="social-section-head">
          <div><p className="eyebrow">PUBLISHER</p><h2>Create one post, send everywhere</h2></div>
          <span className={`pill ${allConnected ? "accent" : ""}`}>{allConnected ? "Ready to publish" : "Queue mode"}</span>
        </div>

        <label>Platforms</label>
        <div className="platform-picker">
          {platforms.map((platform) => (
            <button className={selected.includes(platform.id) ? "selected" : ""} type="button" key={platform.id} disabled={!canManage} onClick={() => togglePlatform(platform.id)}>
              <span>{platform.short}</span>{platform.name}
            </button>
          ))}
        </div>

        {deliveryIssues.length > 0 && (
          <div className="profile-notice social-notice error">
            <strong>Delivery preflight</strong>
            <div>{deliveryIssues.map((item) => item.message).join(" ")}</div>
            <small>Draft remains available. Publish Now will send valid connected channels and keep blocked channels safely in the queue.</small>
          </div>
        )}
        {connectionIssues.length > 0 && (
          <div className="profile-notice social-notice">
            <strong>Connection readiness</strong>
            <div>{connectionIssues.map((item) => item.connectionCheckFailed ? item.name + " health check failed." : item.name + " is not connected.").join(" ")}</div>
          </div>
        )}

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

        {youtubeSelected && youtubeConnected && (
          <div className="social-form-grid">
            <label>
              YouTube privacy
              <select value={youtubePrivacyStatus} onChange={(e) => setYouTubePrivacyStatus(e.target.value as "public" | "private" | "unlisted")}>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label>
              Made for kids
              <select value={youtubeMadeForKids ? "yes" : "no"} onChange={(e) => setYouTubeMadeForKids(e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>
        )}

        {pinterestSelected && pinterestConnected && (
          <div className="social-form-grid">
            <label>
              Pinterest board
              <select value={pinterestBoardId} onChange={(e) => setPinterestBoardId(e.target.value)} disabled={pinterestLoading}>
                <option value="">{pinterestLoading ? "Loading boards..." : "Choose board"}</option>
                {pinterestBoards.map((board) => <option key={board.id} value={board.id}>{board.name}{board.privacy ? ` · ${board.privacy.toLowerCase()}` : ""}</option>)}
              </select>
            </label>
            <label>
              Pinterest format
              <input value={["video", "reel", "short"].includes(contentType) ? "Video will stay queued" : "Image Pin ready"} readOnly aria-readonly="true" />
            </label>
          </div>
        )}

        <label>Alt text<input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image for accessibility" /></label>
        <label>Schedule time<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>

        {message && <div className="profile-notice success">{message}</div>}
        {error && <div className="profile-notice error">{error}</div>}

        <div className="social-actions">
          <button className="btn secondary" type="button" disabled={!canManage || busy !== null || selected.length === 0} onClick={() => submit("draft")}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
          <button className="btn secondary" type="button" disabled={!canManage || busy !== null || !scheduledAt || !scheduleReady} onClick={() => submit("schedule")}>{busy === "schedule" ? "Scheduling…" : "Schedule"}</button>
          <button className="btn" type="button" disabled={!canManage || busy !== null || selected.length === 0 || (tiktokSelected && tiktokConnected && tiktokLoading) || (pinterestSelected && pinterestConnected && pinterestLoading)} onClick={() => submit("publish")}>{busy === "publish" ? "Publishing…" : publishWillQueue ? "Publish ready channels" : "Publish now"}</button>
        </div>
      </form>
    </div>
  );
}
