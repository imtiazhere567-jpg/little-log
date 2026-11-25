import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parentChildren, parseReport } from "@/lib/data";
import { centerTz, fmtDate, todayStr } from "@/lib/time";
import PhoneHome from "./PhoneHome";

export default async function PhoneHomePage() {
  const parent = await requireUser("parent", "/app/phone");
  const db = await getDb();
  const kids = await parentChildren(parent.id);
  const unread = await db.select({ channel: s.notifications.channel }).from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), isNull(s.notifications.readAt)));
  const counts = { whatsapp: 0, email: 0, push: 0 };
  for (const n of unread) counts[n.channel]++;
  const [latest] = kids.length ? await db.select().from(s.dailyReports)
    .where(and(inArray(s.dailyReports.childId, kids.map((k) => k.child.id)), eq(s.dailyReports.status, "sent")))
    .orderBy(desc(s.dailyReports.date), desc(s.dailyReports.sentAt)).limit(1) : [];
  const child = kids.find((k) => k.child.id === latest?.childId)?.child;
  const today = todayStr();

  return (
    <PhoneHome
      initialCounts={counts}
      calendar={{
        wd: new Date().toLocaleDateString("en-US", { timeZone: centerTz(), weekday: "short" }).toUpperCase(),
        day: new Date().toLocaleDateString("en-US", { timeZone: centerTz(), day: "numeric" }),
      }}
      widget={latest && child ? {
        title: latest.date === today ? `${child.firstName}'s report is here` : `${child.firstName} · ${fmtDate(latest.date, { weekday: false })}`,
        text: parseReport(latest.content).greeting,
        href: `/app/parent/report/${latest.id}`,
      } : { title: "Littlelog", text: "Today's report arrives around 4:30 PM", href: "/app/parent" }}
    />
  );
}
