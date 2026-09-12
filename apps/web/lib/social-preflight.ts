export type SocialDeliveryPlatform = "instagram" | "facebook" | "linkedin" | "x" | "tiktok" | "youtube" | "pinterest";
export type SocialDeliveryContentType = "reel" | "carousel" | "static" | "story" | "video" | "short";

export type SocialDeliveryInput = {
  platform: SocialDeliveryPlatform;
  contentType: SocialDeliveryContentType;
  caption?: string;
  hashtags?: string;
  cta?: string;
  mediaUrl?: string;
  linkUrl?: string;
  tiktokPrivacyLevel?: string;
  youtubePrivacyStatus?: string;
  pinterestBoardId?: string;
};

export type SocialDeliveryIssue = {
  platform: SocialDeliveryPlatform;
  code: string;
  message: string;
};

const videoTypes = new Set<SocialDeliveryContentType>(["reel", "video", "short"]);

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function getSocialDeliveryIssues(input: SocialDeliveryInput): SocialDeliveryIssue[] {
  const issue = (code: string, message: string): SocialDeliveryIssue => ({
    platform: input.platform,
    code,
    message,
  });

  if (input.platform === "facebook") {
    if (["reel", "video", "short", "carousel", "story"].includes(input.contentType)) {
      return [issue("FACEBOOK_FORMAT_NOT_READY", "Facebook direct publishing currently supports static/photo or link posts only.")];
    }
    return [];
  }

  if (input.platform === "instagram") {
    if (!input.mediaUrl) return [issue("INSTAGRAM_MEDIA_REQUIRED", "Instagram needs a public image or video URL.")];
    if (["carousel", "story"].includes(input.contentType)) {
      return [issue("INSTAGRAM_FORMAT_NOT_READY", "Instagram carousel and story publishing are not enabled yet.")];
    }
    return [];
  }

  if (input.platform === "linkedin") {
    if (input.mediaUrl) {
      return [issue("LINKEDIN_MEDIA_UPLOAD_NOT_READY", "LinkedIn direct media upload is not enabled yet; use a text or article-link post.")];
    }
    if (["reel", "video", "short", "story", "carousel"].includes(input.contentType)) {
      return [issue("LINKEDIN_FORMAT_NOT_READY", "LinkedIn direct publishing currently supports static text or article-link posts only.")];
    }
    return [];
  }

  if (input.platform === "x") {
    if (input.mediaUrl) return [issue("X_MEDIA_UPLOAD_NOT_READY", "X direct media upload is not enabled yet; use a text or link post.")];
    if (["reel", "video", "short", "story", "carousel"].includes(input.contentType)) {
      return [issue("X_FORMAT_NOT_READY", "X direct publishing currently supports text or link posts only.")];
    }
    const text = [input.caption, input.cta, input.linkUrl, input.hashtags].filter((value) => value?.trim()).join(" ");
    if (!text) return [issue("X_TEXT_REQUIRED", "X needs post text, a CTA, hashtags, or a destination link.")];
    return [];
  }

  if (input.platform === "tiktok") {
    const issues: SocialDeliveryIssue[] = [];
    if (!input.mediaUrl) issues.push(issue("TIKTOK_MEDIA_REQUIRED", "TikTok needs a public video URL."));
    if (!videoTypes.has(input.contentType)) issues.push(issue("TIKTOK_FORMAT_NOT_READY", "TikTok direct publishing requires Reel, Video, or Short format."));
    if (!input.tiktokPrivacyLevel) issues.push(issue("TIKTOK_PRIVACY_REQUIRED", "Choose a TikTok privacy level."));
    return issues;
  }

  if (input.platform === "youtube") {
    const issues: SocialDeliveryIssue[] = [];
    if (!input.mediaUrl) issues.push(issue("YOUTUBE_MEDIA_REQUIRED", "YouTube needs a public video URL."));
    if (!videoTypes.has(input.contentType)) issues.push(issue("YOUTUBE_FORMAT_NOT_READY", "YouTube direct publishing requires Video, Short, or Reel format."));
    if (!input.youtubePrivacyStatus) issues.push(issue("YOUTUBE_PRIVACY_REQUIRED", "Choose a YouTube privacy setting."));
    return issues;
  }

  if (input.platform === "pinterest") {
    const issues: SocialDeliveryIssue[] = [];
    if (!input.pinterestBoardId) issues.push(issue("PINTEREST_BOARD_REQUIRED", "Choose a Pinterest board."));
    if (!input.mediaUrl) issues.push(issue("PINTEREST_MEDIA_REQUIRED", "Pinterest needs a public image URL."));
    if (["video", "reel", "short", "story", "carousel"].includes(input.contentType)) {
      issues.push(issue("PINTEREST_VIDEO_UPLOAD_NOT_READY", "Pinterest direct publishing currently supports image Pins only."));
    }
    return issues;
  }

  return [];
}

export function getStoredSocialPostDeliveryIssues(post: {
  platform: string;
  contentType: string;
  caption?: string | null;
  metadataJson?: unknown;
}) {
  const meta = metadata(post.metadataJson);
  return getSocialDeliveryIssues({
    platform: post.platform as SocialDeliveryPlatform,
    contentType: post.contentType as SocialDeliveryContentType,
    caption: post.caption || undefined,
    hashtags: stringValue(meta.hashtags),
    cta: stringValue(meta.cta),
    mediaUrl: stringValue(meta.mediaUrl),
    linkUrl: stringValue(meta.linkUrl),
    tiktokPrivacyLevel: stringValue(meta.tiktokPrivacyLevel),
    youtubePrivacyStatus: stringValue(meta.youtubePrivacyStatus),
    pinterestBoardId: stringValue(meta.pinterestBoardId),
  });
}

export function socialDeliveryIssueMessage(issues: SocialDeliveryIssue[]) {
  return issues.map((item) => item.message).join(" ");
}

export function socialDeliveryIssuesByPlatform(inputs: SocialDeliveryInput[]) {
  const map = new Map<SocialDeliveryPlatform, SocialDeliveryIssue[]>();
  for (const input of inputs) {
    const issues = getSocialDeliveryIssues(input);
    if (issues.length) map.set(input.platform, issues);
  }
  return map;
}
