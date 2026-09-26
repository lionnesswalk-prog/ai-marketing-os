CREATE TABLE "PlatformProviderConfig" (
    "provider" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformProviderConfig_pkey" PRIMARY KEY ("provider")
);
