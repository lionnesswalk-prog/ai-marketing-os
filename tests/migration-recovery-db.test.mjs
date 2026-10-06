import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { historicalMigrations, reconcile } from "../scripts/reconcile-production-migrations.mjs";

assert.equal(process.env.TEST_DATABASE_ISOLATED, "true");
const url = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Recovery fixtures must never connect to a remote database");
const name = "migration_recovery_test_" + randomUUID().replaceAll("-", "");
const admin = new Client({ connectionString: url.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
url.pathname = "/" + name;
const env = { ...process.env, DATABASE_URL: url.toString(), TEST_DATABASE_ISOLATED: "true" };
const fixture = new Client({ connectionString: url.toString() });
const prisma = (...args) => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
try {
  prisma("deploy");
  await fixture.connect();
  await fixture.query('INSERT INTO "Workspace" (id, name) VALUES ($1, $2)', ["recovery-workspace", "Preserved workspace"]);
  await fixture.query('INSERT INTO "Brand" (id, "workspaceId", name) VALUES ($1, $2, $3)', ["recovery-brand", "recovery-workspace", "Preserved brand"]);
  await fixture.query('INSERT INTO "BrandCopilotMessage" (id, "brandId", role, content) VALUES ($1, $2, $3, $4)', ["recovery-message", "recovery-brand", "user", "Preserve this content"]);

  // Only this newly created, disposable fixture simulates manually applied SQL.
  await fixture.query('DROP TABLE "PlatformProviderConfig"');
  await fixture.query('DELETE FROM "_prisma_migrations" WHERE migration_name = ANY($1::text[])', [[...Object.keys(historicalMigrations), "20260926133000_platform_provider_config"]]);
  const [first, checksum] = Object.entries(historicalMigrations)[0];
  await fixture.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, NOW(), 0)', [randomUUID(), checksum, first]);
  await fixture.query('ALTER TABLE "BrandCopilotMessage" RENAME COLUMN content TO changed_content');
  await assert.rejects(() => reconcile({ apply: true, env, log: () => {} }), /unexpected drift/);
  assert.equal((await fixture.query('SELECT COUNT(*)::integer AS count FROM "_prisma_migrations" WHERE migration_name = ANY($1::text[]) AND finished_at IS NOT NULL', [Object.keys(historicalMigrations)])).rows[0].count, 0);
  await fixture.query('ALTER TABLE "BrandCopilotMessage" RENAME COLUMN changed_content TO content');

  assert.equal((await reconcile({ env, log: () => {} })).length, 6, "read-only check finds the existing schema without recording it");
  assert.equal((await fixture.query('SELECT COUNT(*)::integer AS count FROM "_prisma_migrations" WHERE migration_name = ANY($1::text[]) AND finished_at IS NOT NULL', [Object.keys(historicalMigrations)])).rows[0].count, 0);
  assert.equal((await reconcile({ apply: true, env })).length, 6);
  assert.equal((await fixture.query('SELECT content FROM "BrandCopilotMessage" WHERE id = $1', ["recovery-message"])).rows[0].content, "Preserve this content");
  prisma("deploy");
  assert.deepEqual(await reconcile({ apply: true, env }), []);
  assert.equal((await fixture.query('SELECT to_regclass(\'public."PlatformProviderConfig"\') AS name')).rows[0].name, '"PlatformProviderConfig"');
  console.log("Migration recovery preserved existing data, rejected schema drift, and deployed the pending Meta table.");
} finally {
  await fixture.end();
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
