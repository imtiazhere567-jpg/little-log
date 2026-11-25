import { NextResponse, type NextRequest } from "next/server";
import { currentUser, type Role } from "@/lib/session";
import { canChat, markThreadRead, postMessage, threadMessages } from "@/lib/chat";

// The same browser can be signed in as teacher, parent and director at once (one cookie per role),
// so every call says which role it speaks for.
const ROLES: Role[] = ["teacher", "parent", "director"];
const asRole = (v: unknown) => (ROLES.includes(v as Role) ? (v as Role) : null);

/** New messages in a thread after ?after=<id>. Reading marks the thread read. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const role = asRole(q.get("role"));
  const childId = Number(q.get("child"));
  const user = role ? await currentUser(role) : null;
  if (!user || !childId || !(await canChat(user, childId))) return NextResponse.json({ messages: [] }, { status: 403 });
  const messages = await threadMessages(childId, Number(q.get("after")) || 0);
  if (messages.length) await markThreadRead(user.id, childId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { role?: string; child?: number; body?: string; replyToId?: number | null };
  const role = asRole(body.role);
  const childId = Number(body.child);
  const user = role ? await currentUser(role) : null;
  if (!user || !childId || !(await canChat(user, childId))) return NextResponse.json({ ok: false }, { status: 403 });
  if (!String(body.body ?? "").trim()) return NextResponse.json({ ok: false, error: "Type a message first" }, { status: 400 });
  const id = await postMessage(user, childId, String(body.body), body.replyToId ? Number(body.replyToId) : null);
  return NextResponse.json({ ok: true, id });
}
