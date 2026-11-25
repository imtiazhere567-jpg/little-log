import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { currentUser } from "@/lib/session";
import { runAttendanceReminders } from "@/lib/attendance";
import { fmtTime, minutesBetween, nowTime, todayStr } from "@/lib/time";

/** The director's bell: latest alerts + a live "reports not sent yet" reminder near send time. */
export async function GET() {
  const director = await currentUser("director");
  if (!director) return NextResponse.json({ items: [], unread: 0, due: null }, { status: 401 });
  await runAttendanceReminders();
  const db = await getDb();
  const items = await db.select().from(s.staffAlerts).where(eq(s.staffAlerts.centerId, director.centerId))
    .orderBy(desc(s.staffAlerts.id)).limit(25);
  const unread = (await db.select({ id: s.staffAlerts.id }).from(s.staffAlerts)
    .where(and(eq(s.staffAlerts.centerId, director.centerId), isNull(s.staffAlerts.readAt)))).length;

  // reminder: from 1 hour before the send time, while reports are still missing
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
  const kids = await db.select({ id: s.children.id }).from(s.children).innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(eq(s.rooms.centerId, director.centerId));
  const sent = kids.length ? (await db.select({ id: s.dailyReports.id }).from(s.dailyReports)
    .where(and(eq(s.dailyReports.date, todayStr()), eq(s.dailyReports.status, "sent"), inArray(s.dailyReports.childId, kids.map((k) => k.id))))).length : 0;
  const notSent = kids.length - sent;
  const left = minutesBetween(nowTime(), center.reportSendTime);
  const due = notSent > 0 && left <= 60
    ? { notSent, title: `${notSent} report${notSent === 1 ? "" : "s"} not sent yet`, body: left > 0 ? `Due at ${fmtTime(center.reportSendTime)} · ${left} min left` : `Were due at ${fmtTime(center.reportSendTime)}`, href: "/director/reports?status=ready" }
    : null;

  return NextResponse.json({
    items: items.map((a) => ({ id: a.id, kind: a.kind, title: a.title, body: a.body, href: a.href, createdAt: a.createdAt.toISOString(), read: !!a.readAt })),
    unread, due,
  });
}

/** { all: true } marks everything read; { id } marks one. */
export async function POST(req: NextRequest) {
  const director = await currentUser("director");
  if (!director) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json()) as { all?: boolean; id?: number };
  const db = await getDb();
  const mine = and(eq(s.staffAlerts.centerId, director.centerId), isNull(s.staffAlerts.readAt));
  await db.update(s.staffAlerts).set({ readAt: new Date() })
    .where(body.id ? and(mine, eq(s.staffAlerts.id, Number(body.id))) : mine);
  return NextResponse.json({ ok: true });
}
