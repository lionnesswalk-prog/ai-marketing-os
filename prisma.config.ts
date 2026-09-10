import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma Client generation does not connect to the database, but Prisma 7 still
// expects a datasource URL while loading the config. Use a harmless local
// placeholder when DATABASE_URL is not configured so preview/Vercel builds can
// generate the client successfully. Runtime database access still requires a
// real DATABASE_URL in apps/web/lib/prisma.ts.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://preview:preview@127.0.0.1:5432/ai_marketing_os";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
