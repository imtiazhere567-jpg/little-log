import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { APP_HOME, COOKIE, DEMO_EMAIL, type Role } from "@/lib/session";

// One-click demo login: signs in as the default demo user for a role, or as a
// specific user (?user=<id>) so the simulator can "view as" any parent or teacher.
// DEMO ONLY: a real deployment replaces this with invite links + passwords.
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") as Role | null;
  if (!role || !(role in COOKIE)) return NextResponse.json({ error: "unknown role" }, { status: 400 });
  const next = req.nextUrl.searchParams.get("next") ?? APP_HOME[role];
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : APP_HOME[role];
  const asUser = Number(req.nextUrl.searchParams.get("user")) || null;

  const db = await getDb();
  const [user] = asUser
    ? await db.select().from(schema.users).where(and(eq(schema.users.id, asUser), eq(schema.users.role, role)))
    : await db.select().from(schema.users).where(eq(schema.users.email, DEMO_EMAIL[role]));
  if (!user) return NextResponse.json({ error: `No ${role} with that id` }, { status: 404 });

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set(COOKIE[role], String(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
