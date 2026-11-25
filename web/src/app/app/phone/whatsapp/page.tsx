import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { fmtStamp, dateOf, todayStr } from "@/lib/time";

/** WhatsApp-style chat list. Only the daycare's chat is part of the demo. */
export default async function WhatsAppList() {
  const parent = await requireUser("parent", "/app/phone");
  const db = await getDb();
  const msgs = await db.select().from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), eq(s.notifications.channel, "whatsapp")))
    .orderBy(desc(s.notifications.id));
  const unread = (await db.select({ id: s.notifications.id }).from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), eq(s.notifications.channel, "whatsapp"), isNull(s.notifications.readAt)))).length;
  const last = msgs[0];
  const when = last ? (dateOf(new Date(last.createdAt)) === todayStr() ? fmtStamp(last.createdAt, { date: false }) : fmtStamp(last.createdAt, { time: false })) : "";

  return (
    <div className="min-h-screen bg-white">
      <header className="px-4 pb-2 pt-[54px]">
        <div className="flex items-center justify-between">
          <Link href="/app/phone" className="text-[15px] font-semibold text-[#1C8D4E]">‹ Home</Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E9F6EE] text-[#1C8D4E]">✎</span>
        </div>
        <h1 className="mt-2 text-[32px] font-bold tracking-tight">Chats</h1>
        <div className="mt-2 rounded-xl bg-[#F1F2F4] px-3 py-2 text-[15px] text-[#8E8E93]">Search</div>
      </header>

      <Link href="/app/phone/whatsapp/chat" className="flex items-center gap-3 border-b border-[#EDEDED] px-4 py-3 active:bg-[#F5F5F5]">
        <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-full bg-gradient-to-br from-[#F2B07A] to-accent text-[15px] font-bold text-white">SD</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between">
            <b className="flex items-center gap-1 text-[16px]">Sunny Days Childcare <span className="grid h-4 w-4 place-items-center rounded-full bg-[#25A35A] text-[9px] text-white">✓</span></b>
            <span className={`text-[13px] ${unread ? "font-semibold text-[#25A35A]" : "text-[#8E8E93]"}`}>{when}</span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className="line-clamp-2 text-[14px] leading-[19px] text-[#8E8E93]">{last?.body ?? "No messages yet"}</span>
            {unread > 0 && <span className="grid h-[22px] min-w-[22px] flex-none place-items-center rounded-full bg-[#25A35A] px-1.5 text-[12px] font-bold text-white">{unread}</span>}
          </span>
        </span>
      </Link>
      <p className="px-6 py-6 text-center text-[12.5px] leading-5 text-[#8E8E93]">
        The daycare sends “report is ready” messages here. They never contain your child&apos;s details.
      </p>
    </div>
  );
}
