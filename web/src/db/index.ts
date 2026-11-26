import "server-only";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { DDL, ALL_TABLES } from "./ddl";
import { seedDemoData } from "./seed";
import { setCenterTz, todayStr } from "@/lib/time";

export type Db = PgliteDatabase<typeof schema>;

type Holder = { ready?: Promise<Db>; day?: string };
const g = globalThis as unknown as { __littlelog?: Holder };
const holder: Holder = (g.__littlelog ??= {});

async function connect(): Promise<Db> {
  // Vercel's Neon integration may name the variable differently (or with a custom prefix).
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    Object.entries(process.env).find(([k, v]) => /_(DATABASE|POSTGRES)_URL$/.test(k) && v?.startsWith("postgres"))?.[1];
  if (!url && process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.");
  }
  if (url) {
    // Production / Vercel: Neon serverless Postgres over HTTP.
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as Db;
  }
  // Local development: PGlite, a real Postgres running in-process.
  // Stored OUTSIDE the web/ folder: the dev server watches web/, and every database
  // write inside it would trigger a rebuild and reload the open pages.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { mkdirSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const dir = process.env.PGLITE_DIR ?? resolve(process.cwd(), "..", ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return drizzle(client, { schema });
}

/** First row of a raw query (PGlite returns { rows }, Neon HTTP returns the rows array). */
const first = <T,>(res: unknown): T | undefined =>
  (res as { rows?: T[] }).rows?.[0] ?? (Array.isArray(res) ? (res[0] as T) : undefined);

// A fingerprint of the table SQL: when it changes, the DDL runs again (once), otherwise it's skipped.
// On Vercel every cold start would otherwise send ~60 statements to Neon before the first page.
const SCHEMA_VERSION = (() => {
  let h = 5381;
  for (const ch of DDL.join("\n")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return `v${(h >>> 0).toString(36)}`;
})();

async function init(db: Db) {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS demo_meta (key text PRIMARY KEY, value text NOT NULL)`));
  const schema = first<{ value: string }>(await db.execute(sql`SELECT value FROM demo_meta WHERE key = 'schema'`))?.value;
  if (schema !== SCHEMA_VERSION) {
    for (const stmt of DDL) await db.execute(sql.raw(stmt));
    await db.execute(sql`INSERT INTO demo_meta (key, value) VALUES ('schema', ${SCHEMA_VERSION})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
  }
  // "today" is the daycare's today: use its time zone from here on
  setCenterTz(first<{ timezone: string }>(await db.execute(sql`SELECT timezone FROM centers ORDER BY id LIMIT 1`))?.timezone);
  const n = first<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM centers`))?.n ?? 0;

  // Demo freshness: the sample day is built around "today". When the stored data is
  // from an earlier day, rebuild it so every visitor sees a live-looking school day.
  const d = n ? first<{ d: string | null }>(await db.execute(sql`SELECT max(date) AS d FROM voice_notes`))?.d ?? null : null;
  const today = todayStr();
  if (n > 0 && d && d >= today) return;

  // On Vercel many servers can wake up at once: only the one that claims today's key rebuilds,
  // the others wait for it (so the demo data is never created twice).
  const key = `seed:${today}`;
  const claimed = first<{ key: string }>(await db.execute(sql`INSERT INTO demo_meta (key, value) VALUES (${key}, 'running')
    ON CONFLICT (key) DO NOTHING RETURNING key`));
  if (claimed) {
    try {
      if (n > 0) await db.execute(sql.raw(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY`));
      await seedDemoData(db);
      await db.execute(sql`UPDATE demo_meta SET value = 'done' WHERE key = ${key}`);
    } catch (e) {
      await db.execute(sql`DELETE FROM demo_meta WHERE key = ${key}`); // let the next request try again
      throw e;
    }
    return;
  }
  for (let i = 0; i < 90; i++) {
    const v = first<{ value: string }>(await db.execute(sql`SELECT value FROM demo_meta WHERE key = ${key}`))?.value;
    if (v !== "running") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Returns a ready-to-use database, creating tables and demo data on first use.
 * The promise is stored synchronously, so parallel callers (e.g. a layout and its
 * page rendering at the same time) share one connection instead of opening two.
 */
export function getDb(): Promise<Db> {
  // A new day: re-run the freshness check once on the existing connection.
  const today = todayStr();
  if (holder.ready && holder.day !== today) {
    holder.day = today;
    holder.ready = holder.ready.then(async (db) => { await init(db); return db; });
  }
  holder.day ??= today;
  holder.ready ??= (async () => {
    const db = await connect();
    await init(db);
    return db;
  })().catch((e) => {
    holder.ready = undefined; // let the next request try again from scratch
    throw e;
  });
  return holder.ready;
}

/** Wipes every table and loads fresh demo data. */
export async function resetDemoData() {
  const db = await getDb();
  await db.execute(sql.raw(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY`));
  await seedDemoData(db);
}

export { schema };
