import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { currentUser } from "@/lib/session";
import { runAttendanceReminders } from "@/lib/attendance";

type Channel = "whatsapp" | "email" | "push";

// Unread notifications for the signed-in parent, plus an unread count per app (for icon badges).
export async function GET() {
  const parent = await currentUser("parent");
  if (!parent) return NextResponse.json({ items: [], counts: {} }, { status: 401 });
  await runAttendanceReminders();
  const db = await getDb();
  const unread = await db.select().from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), isNull(s.notifications.readAt)))
    .orderBy(desc(s.notifications.id));
  const counts = { whatsapp: 0, email: 0, push: 0 } as Record<Channel, number>;
  for (const n of unread) counts[n.channel]++;
  return NextResponse.json({ items: unread.slice(0, 9), counts });
}

/**
 * Mark notifications read. Each app keeps its own read state, like a real phone:
 *   { ids: [..] }                     → exactly these
 *   { channel }                       → everything in one app (e.g. opening the WhatsApp chat)
 *   { recordId, kind, channel? }      → one report/incident (optionally only in one app)
 */
export async function POST(req: NextRequest) {
  const parent = await currentUser("parent");
  if (!parent) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { ids?: number[]; channel?: Channel; recordId?: number; kind?: "daily_report" | "incident" | "message" | "attendance" };
  const db = await getDb();
  const mine = and(eq(s.notifications.parentId, parent.id), isNull(s.notifications.readAt));
  const where = body.ids?.length ? and(mine, inArray(s.notifications.id, body.ids.map(Number)))
    : body.recordId && body.kind ? and(mine, eq(s.notifications.recordId, Number(body.recordId)), eq(s.notifications.kind, body.kind),
        ...(body.channel ? [eq(s.notifications.channel, body.channel)] : []))
    : body.channel ? and(mine, eq(s.notifications.channel, body.channel))
    : null;
  if (!where) return NextResponse.json({ ok: false }, { status: 400 });
  await db.update(s.notifications).set({ readAt: new Date() }).where(where);
  return NextResponse.json({ ok: true });
}
