ALTER TABLE "WorkspaceUser"
ADD CONSTRAINT "WorkspaceUser_role_check"
CHECK ("role" IN ('admin','marketing_manager','sales','viewer'));

ALTER TABLE "WorkspaceAccess"
ADD CONSTRAINT "WorkspaceAccess_role_check"
CHECK ("role" IN ('admin','marketing_manager','sales','viewer'));

ALTER TABLE "Approval"
ADD CONSTRAINT "Approval_status_check"
CHECK ("status" IN ('pending','approved','rejected'));

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_intent_check"
CHECK ("intent" IN ('low','medium','high'));

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_status_check"
CHECK ("status" IN ('new','answered','follow_up','human_handoff'));

ALTER TABLE "SocialPost"
ADD CONSTRAINT "SocialPost_platform_check"
CHECK ("platform" IN ('instagram','facebook','linkedin','x','tiktok','youtube','pinterest'));

ALTER TABLE "SocialPost"
ADD CONSTRAINT "SocialPost_contentType_check"
CHECK ("contentType" IN ('reel','carousel','static','story','video','short'));

ALTER TABLE "SocialPost"
ADD CONSTRAINT "SocialPost_status_check"
CHECK ("status" IN ('draft','scheduled','publishing','published','failed'));

ALTER TABLE "MarketingInsight"
ADD CONSTRAINT "MarketingInsight_kind_check"
CHECK ("kind" IN ('creative','budget','landing_page','audience','lead'));

ALTER TABLE "MarketingInsight"
ADD CONSTRAINT "MarketingInsight_severity_check"
CHECK ("severity" IN ('info','watch','action'));
