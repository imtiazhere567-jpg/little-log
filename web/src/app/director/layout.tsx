import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { todayStr } from "@/lib/time";
import Sidebar from "./Sidebar";
import { unreadTotal } from "@/lib/chat";

export default async function DirectorLayout({ children }: LayoutProps<"/director">) {
  const director = await requireUser("director");
  const db = await getDb();
  const today = todayStr();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
  const [drafts, serious, kids, sent, reviews] = await Promise.all([
    db.select({ id: s.incidents.id }).from(s.incidents).where(eq(s.incidents.status, "draft")),
    db.select({ id: s.incidents.id }).from(s.incidents).where(and(eq(s.incidents.status, "draft"), eq(s.incidents.isSerious, true))),
    db.select({ id: s.children.id }).from(s.children),
    db.select({ id: s.dailyReports.id }).from(s.dailyReports).where(and(eq(s.dailyReports.date, today), eq(s.dailyReports.status, "sent"))),
    db.select({ id: s.logEntries.id }).from(s.logEntries).where(and(eq(s.logEntries.needsReview, true), isNull(s.logEntries.childId))),
  ]);
  const messages = await unreadTotal(director);
  const here = (await db.select({ id: s.attendance.id }).from(s.attendance)
    .where(and(eq(s.attendance.date, today), isNotNull(s.attendance.checkInAt), isNull(s.attendance.checkOutAt), eq(s.attendance.absent, false)))).length;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        name={director.name}
        centerName={center.name}
        sendTime={center.reportSendTime}
        counts={{ drafts: drafts.length, serious: serious.length, children: kids.length, sent: sent.length, reviews: reviews.length, messages, here }}
      />
      <main className="min-w-0 flex-1 px-6 py-7 md:px-10 2xl:px-14">{children}</main>
    </div>
  );
}
