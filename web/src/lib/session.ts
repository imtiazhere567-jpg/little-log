import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type Role = "teacher" | "parent" | "director";

// One cookie per role so the teacher phone, parent phone and director desktop
// can all be open at the same time in one browser.
export const COOKIE: Record<Role, string> = {
  teacher: "ll_teacher",
  parent: "ll_parent",
  director: "ll_director",
};

/** Where each role's app lives. Teacher and parent apps run inside the phone simulator. */
export const APP_HOME: Record<Role, string> = {
  teacher: "/app/teacher",
  parent: "/app/parent",
  director: "/director",
};

export const DEMO_EMAIL: Record<Role, string> = {
  teacher: "sara@sunnydays.demo",
  parent: "sarah.carter@example.com",
  director: "maria@sunnydays.demo",
};

export type User = typeof schema.users.$inferSelect;

/** Signed-in user for a role. Cached per request, so a layout and its page share one lookup (and one object). */
export const currentUser = cache(async (role: Role): Promise<User | null> => {
  const id = Number((await cookies()).get(COOKIE[role])?.value);
  if (!id) return null;
  const db = await getDb();
  const [u] = await db.select().from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.role, role)));
  return u ?? null;
});

/** Use in pages/layouts: sends the visitor through one-click demo login if needed. */
export async function requireUser(role: Role, next?: string): Promise<User> {
  const u = await currentUser(role);
  // after the one-click demo sign-in, come back to where the visitor was going
  // the director signs in on a real sign-in page; the phone apps use one-tap demo sign-in
  if (!u && role === "director") redirect(`/login?next=${encodeURIComponent(next ?? APP_HOME.director)}`);
  if (!u) redirect(`/api/demo-login?role=${role}&next=${encodeURIComponent(next ?? APP_HOME[role])}`);
  return u;
}

/** Use in server actions: throws instead of redirecting. */
export async function assertUser(role: Role): Promise<User> {
  const u = await currentUser(role);
  if (!u) throw new Error("Not signed in");
  return u;
}

export async function audit(userId: number, action: string, tableName: string, recordId: number) {
  const db = await getDb();
  await db.insert(schema.auditLog).values({ userId, action, tableName, recordId });
}
