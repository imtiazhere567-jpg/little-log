"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { COOKIE, audit, currentUser } from "@/lib/session";

// DEMO sign-in for the director. Every demo director account uses one shared password
// (DEMO_PASSWORD, default "demo1234"). A real launch replaces this with hashed passwords
// or a hosted auth provider, plus password reset and 2-step verification.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";

const safeNext = (v: FormDataEntryValue | null) => {
  const n = String(v ?? "");
  return n.startsWith("/director") && !n.startsWith("//") ? n : "/director";
};

export async function signIn(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(fd.get("next"));
  const back = (error: string) => redirect(`/login?error=${error}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  if (!email || !password) back("missing");

  const db = await getDb();
  const [u] = await db.select().from(s.users).where(and(eq(s.users.email, email), eq(s.users.role, "director")));
  // same message for "no such account" and "wrong password", so nobody can probe which emails exist
  if (!u || password !== DEMO_PASSWORD) back("wrong");

  (await cookies()).set(COOKIE.director, String(u!.id), {
    httpOnly: true, sameSite: "lax", path: "/",
    ...(fd.get("remember") ? { maxAge: 60 * 60 * 24 * 30 } : {}), // otherwise: until the browser closes
  });
  await audit(u!.id, "signed_in", "users", u!.id);
  redirect(next);
}

export async function signOut() {
  const u = await currentUser("director");
  if (u) await audit(u.id, "signed_out", "users", u.id);
  (await cookies()).delete(COOKIE.director);
  redirect("/login?out=1");
}
