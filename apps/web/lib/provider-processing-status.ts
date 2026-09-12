export type ProcessingDeliveryStatus = "publishing" | "published" | "failed";

export function classifyTikTokPublishStatus(status?: string): ProcessingDeliveryStatus {
  if (status === "PUBLISH_COMPLETE") return "published";
  if (status === "FAILED") return "failed";
  return "publishing";
}

export function classifyYouTubePublishStatus(input: {
  uploadStatus?: string;
  processingStatus?: string;
}): ProcessingDeliveryStatus {
  if (input.uploadStatus === "failed" || input.uploadStatus === "rejected") return "failed";
  if (input.uploadStatus === "processed" || input.processingStatus === "succeeded") return "published";
  return "publishing";
}
