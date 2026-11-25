import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { dateOf, fmtDate, fmtStamp, todayStr } from "@/lib/time";

/** Mail-style inbox: the daycare's "report is ready" emails. */
export default async function MailInbox() {
  const parent = await requireUser("parent", "/app/phone");
  const db = await getDb();
  const mails = await db.select().from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), eq(s.notifications.channel, "email")))
    .orderBy(desc(s.notifications.id));
  const unread = mails.filter((m) => !m.readAt).length;
  const today = todayStr();

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 pb-2 pt-[54px]">
        <Link href="/app/phone" className="text-[15px] font-semibold text-[#3D7BE0]">‹ Home</Link>
        <h1 className="mt-2 text-[32px] font-bold tracking-tight">Inbox</h1>
        <p className="text-[13px] text-[#8E8E93]">{parent.email} · {unread ? `${unread} unread` : "all read"}</p>
      </header>
      <div className="mt-1">
        {mails.map((m) => {
          const d = dateOf(new Date(m.createdAt));
          return (
            <Link key={m.id} href={`/app/phone/mail/${m.id}`} className="flex gap-2 border-b border-[#EDEDED] py-3 pl-2 pr-4 active:bg-[#F5F5F5]">
              <span className="mt-1.5 w-3 flex-none">{!m.readAt && <span className="block h-2.5 w-2.5 rounded-full bg-[#3D7BE0]" />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="truncate text-[15.5px]">Sunny Days Childcare</b>
                  <span className="flex-none text-[13px] text-[#8E8E93]">{d === today ? fmtStamp(m.createdAt, { date: false }) : fmtDate(d, { weekday: false })} ›</span>
                </span>
                <span className={`block truncate text-[14.5px] ${m.readAt ? "" : "font-semibold"}`}>{m.title}</span>
                <span className="line-clamp-2 block text-[14px] leading-[19px] text-[#8E8E93]">{m.body}</span>
              </span>
            </Link>
          );
        })}
        {mails.length === 0 && <p className="py-12 text-center text-sm text-[#8E8E93]">No mail.</p>}
      </div>
    </div>
  );
}
