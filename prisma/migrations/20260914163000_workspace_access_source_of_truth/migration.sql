ALTER TABLE "WorkspaceUser"
DROP CONSTRAINT IF EXISTS "WorkspaceUser_role_check";

ALTER TABLE "WorkspaceUser"
DROP CONSTRAINT IF EXISTS "WorkspaceUser_workspaceId_fkey";

DROP INDEX IF EXISTS "WorkspaceUser_workspaceId_email_key";
DROP INDEX IF EXISTS "WorkspaceUser_workspaceId_idx";

ALTER TABLE "WorkspaceUser"
DROP COLUMN "role",
DROP COLUMN "workspaceId";
