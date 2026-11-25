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
  const url = process.env.DATABASE_URL;
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

async function init(db: Db) {
  for (const stmt of DDL) await db.execute(sql.raw(stmt));
  // "today" is the daycare's today: use its time zone from here on
  const tzRows = await db.execute<{ timezone: string }>(sql`SELECT timezone FROM centers ORDER BY id LIMIT 1`);
  setCenterTz((tzRows as unknown as { rows: { timezone: string }[] }).rows?.[0]?.timezone ??
    (tzRows as unknown as { timezone: string }[])[0]?.timezone);
  const rows = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM centers`);
  const n = (rows as unknown as { rows: { n: number }[] }).rows?.[0]?.n ??
    (rows as unknown as { n: number }[])[0]?.n ?? 0;
  if (n === 0) return seedDemoData(db);

  // Demo freshness: the sample day is built around "today". When the stored data is
  // from an earlier day, rebuild it so every visitor sees a live-looking school day.
  const latest = await db.execute<{ d: string | null }>(sql`SELECT max(date) AS d FROM voice_notes`);
  const d = (latest as unknown as { rows: { d: string | null }[] }).rows?.[0]?.d ??
    (latest as unknown as { d: string | null }[])[0]?.d ?? null;
  if (!d || d < todayStr()) {
    await db.execute(sql.raw(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY`));
    await seedDemoData(db);
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
