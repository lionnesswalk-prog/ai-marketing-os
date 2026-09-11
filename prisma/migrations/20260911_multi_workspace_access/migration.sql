CREATE TABLE "WorkspaceAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAccess_userId_workspaceId_key"
ON "WorkspaceAccess"("userId", "workspaceId");

CREATE INDEX "WorkspaceAccess_workspaceId_idx"
ON "WorkspaceAccess"("workspaceId");

ALTER TABLE "WorkspaceAccess"
ADD CONSTRAINT "WorkspaceAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "WorkspaceUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceAccess"
ADD CONSTRAINT "WorkspaceAccess_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceAccess" ("id", "userId", "workspaceId", "role", "createdAt")
SELECT
  'wa_' || md5(random()::text || clock_timestamp()::text || "id"),
  "id",
  "workspaceId",
  "role",
  CURRENT_TIMESTAMP
FROM "WorkspaceUser"
ON CONFLICT ("userId", "workspaceId") DO NOTHING;
