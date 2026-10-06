import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertTarget, assertVerifiedDiff, historicalMigrations, planRecovery, verifyMigrationFiles } from "../scripts/reconcile-production-migrations.mjs";

const metaSql = readFileSync(new URL("../prisma/migrations/20260926133000_platform_provider_config/migration.sql", import.meta.url), "utf8");
const rows = Object.entries(historicalMigrations).map(([migration_name, checksum]) => ({ migration_name, checksum, finished_at: "2026-09-26", rolled_back_at: null }));

test("only the observed production database or explicitly isolated fixture is accepted", () => {
  assertTarget({ DATABASE_URL: "postgresql://user:secret@ep-little-heart-b3sceml5-pooler.c-4.ap-southeast-1.aws.neon.tech/ai_marketing_os" });
  assertTarget({ DATABASE_URL: "postgresql://postgres@localhost/migration_recovery_test_123", TEST_DATABASE_ISOLATED: "true" });
  for (const DATABASE_URL of [undefined, "invalid", "postgresql://localhost/ai_marketing_os", "postgresql://other.neon.tech/ai_marketing_os", "postgresql://ep-little-heart-b3sceml5-pooler.c-4.ap-southeast-1.aws.neon.tech/other"]) {
    assert.throws(() => assertTarget({ DATABASE_URL }), /required|restricted/);
  }
});

test("migration SQL is pinned before recovery", () => verifyMigrationFiles());

test("completed records are a no-op; absent and failed known records are recoverable", () => {
  assert.deepEqual(planRecovery(rows), []);
  assert.deepEqual(planRecovery([]), Object.keys(historicalMigrations));
  assert.deepEqual(planRecovery([{ ...rows[0], finished_at: null }, ...rows.slice(1)]), [rows[0].migration_name]);
  assert.deepEqual(planRecovery([{ ...rows[0], rolled_back_at: "2026-09-27" }, ...rows.slice(1)]), [rows[0].migration_name]);
});

test("unknown failures and altered historical checksums stop recovery", () => {
  assert.throws(() => planRecovery([...rows, { migration_name: "unknown", checksum: "x", finished_at: null }]), /Unknown failed/);
  assert.throws(() => planRecovery([{ ...rows[0], checksum: "x" }, ...rows.slice(1)]), /checksum mismatch/);
});

test("schema comparison allows only no drift or the exact pending Meta table", () => {
  assertVerifiedDiff("-- This is an empty migration.\n", metaSql);
  assertVerifiedDiff(`-- CreateTable\n${metaSql}`, metaSql);
  for (const sql of [metaSql.replace("TEXT NOT NULL", "TEXT"), `${metaSql}\nDROP TABLE "BrandCopilotMessage";`, 'ALTER TABLE "ContentCalendarPlan" DROP COLUMN "sourceReviewId";', 'CREATE TABLE "BrandAsset" ("id" TEXT);']) {
    assert.throws(() => assertVerifiedDiff(sql, metaSql), /unexpected drift/);
  }
});
