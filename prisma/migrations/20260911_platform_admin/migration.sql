ALTER TABLE "WorkspaceUser"
ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "WorkspaceUser"
SET "isPlatformAdmin" = true
WHERE "id" = (
  SELECT "id"
  FROM "WorkspaceUser"
  ORDER BY "createdAt" ASC
  LIMIT 1
);
