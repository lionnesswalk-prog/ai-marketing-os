import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const historicalMigrations = Object.freeze({
  "20260916113000_brand_copilot_history": "f6e64810c736ae9d40ee6e64fc869d2ed7659cac03322a25bd219e8def995682",
  "20260916120000_brand_assets": "3fa382fafd4492f70b4751924954a1a8d0730d495ed5e90df730ff868068cf5e",
  "20260916124500_content_calendar": "a2f863d4f92b8d175f8579fb8c207306edee24c32aaa1a6551c2aa1b8cc526d7",
  "20260918120000_content_learning": "a87cf93f2e32e143fab5b1aaa9ab5840384b9470642d3836770d51d080ed49ea",
  "20260918123000_weekly_performance_review": "84331025ff0d2d7c977ab1f9c2e86b1825c9a41a13f24a8f8a37c733d0e33432",
  "20260919191500_review_calendar_link": "2ab53459fdb2a949662f9b84bf1e530147da17a56229e737dba93ebd869faa57",
});

export class RecoveryError extends Error {}

export function assertTarget(env) {
  let target;
  try { target = new URL(env.DATABASE_URL); } catch { throw new RecoveryError("DATABASE_URL is required for migration history verification."); }
  const database = decodeURIComponent(target.pathname.slice(1));
  const production = target.hostname === "ep-little-heart-b3sceml5-pooler.c-4.ap-southeast-1.aws.neon.tech" && database === "ai_marketing_os";
  const isolatedTest = env.TEST_DATABASE_ISOLATED === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && database.startsWith("migration_recovery_test_");
  if (!["postgres:", "postgresql:"].includes(target.protocol) || (!production && !isolatedTest)) {
    throw new RecoveryError("Migration history recovery is restricted to the verified production database or an isolated local fixture.");
  }
}

export function verifyMigrationFiles() {
  for (const [name, checksum] of Object.entries(historicalMigrations)) {
    const actual = createHash("sha256").update(readFileSync(resolve(root, "prisma/migrations", name, "migration.sql"))).digest("hex");
    if (actual !== checksum) throw new RecoveryError(`Historical migration changed: ${name}`);
  }
}

export function planRecovery(rows) {
  const active = rows.filter(row => !row.rolled_back_at);
  for (const row of active) {
    if (!row.finished_at && !Object.hasOwn(historicalMigrations, row.migration_name)) {
      throw new RecoveryError(`Unknown failed migration requires investigation: ${row.migration_name}`);
    }
    if (Object.hasOwn(historicalMigrations, row.migration_name) && row.checksum !== historicalMigrations[row.migration_name]) {
      throw new RecoveryError(`Migration history checksum mismatch: ${row.migration_name}`);
    }
  }
  return Object.keys(historicalMigrations).filter(name => !active.some(row => row.migration_name === name && row.finished_at));
}

export function normalizeSql(sql) {
  // Prisma's generated schema SQL contains no SQL strings in the one allowed change.
  return sql.replace(/^--.*$/gm, "").replace(/\s+/g, " ").trim();
}

export function assertVerifiedDiff(sql, metaTableSql) {
  const normalized = normalizeSql(sql);
  if (normalized !== "" && normalized !== normalizeSql(metaTableSql)) {
    throw new RecoveryError("Production schema has unexpected drift; migration history was not changed.");
  }
}

function runPrisma(args, env) {
  try {
    return execFileSync(process.execPath, [resolve(root, "node_modules/prisma/build/index.js"), ...args], {
      cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
    });
  } catch {
    // Child errors can include connection strings; never copy them into build logs.
    throw new RecoveryError(`Prisma ${args.slice(0, 2).join(" ")} failed; migration history recovery stopped.`);
  }
}

export async function reconcile({ apply = false, env = process.env, log = console.log } = {}) {
  assertTarget(env);
  if (apply && env.VERCEL_ENV !== "production" && env.TEST_DATABASE_ISOLATED !== "true") {
    throw new RecoveryError("Migration history may only be resolved in a production build or isolated test.");
  }
  verifyMigrationFiles();
  const { Client } = await import("pg");
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15_000 });
  let locked = false;
  try {
    await client.connect();
    if (apply) {
      const lock = await client.query("SELECT pg_try_advisory_lock(6050926, 24) AS acquired");
      if (!lock.rows[0].acquired) throw new RecoveryError("Another migration history recovery is running; retry this build later.");
      locked = true;
    }
    const { rows } = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at');
    const pending = planRecovery(rows);
    if (pending.length === 0) {
      log("Historical migration records are complete; no reconciliation needed.");
      return [];
    }
    log(`Unrecorded historical migrations: ${pending.join(", ")}`);
    const diff = runPrisma(["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"], env);
    const metaSql = readFileSync(resolve(root, "prisma/migrations/20260926133000_platform_provider_config/migration.sql"), "utf8");
    try { assertVerifiedDiff(diff, metaSql); } catch (error) {
      // Generated schema DDL contains structural metadata only, never application rows.
      log(`Read-only schema comparison:\n${diff}`);
      throw error;
    }
    log("Existing schema matches all historical migrations; only the new Meta settings table may be pending.");
    if (!apply) {
      log("Read-only check completed; no migration records were changed.");
      return pending;
    }
    for (const name of pending) {
      runPrisma(["migrate", "resolve", "--applied", name], env);
      log(`Recorded verified existing migration: ${name}`);
    }
    if (planRecovery((await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"')).rows).length) {
      throw new RecoveryError("Historical migration record verification failed after reconciliation.");
    }
    return pending;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(6050926, 24)");
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !["--check", "--apply"].includes(args[0])) throw new RecoveryError("Use --check (read-only) or --apply (verified history only).");
    await reconcile({ apply: args[0] === "--apply" });
  } catch (error) {
    console.error(error instanceof RecoveryError ? error.message : "Database verification failed; migration history recovery stopped.");
    process.exitCode = 1;
  }
}
