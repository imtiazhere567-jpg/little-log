import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { markReadServer } from "@/lib/notify-read";
import ScrollToBottom from "./ScrollToBottom";
import { dateOf, fmtDate, fmtStamp, todayStr } from "@/lib/time";

/** The chat with the daycare. Opening it marks the WhatsApp messages as read. */
export default async function WhatsAppChat() {
  const parent = await requireUser("parent", "/app/phone");
  const db = await getDb();
  const msgs = await db.select().from(s.notifications)
    .where(and(eq(s.notifications.parentId, parent.id), eq(s.notifications.channel, "whatsapp")))
    .orderBy(asc(s.notifications.id));
  await markReadServer(parent.id, { channel: "whatsapp" });
  const today = todayStr();
  // a date separator above the first message of each day
  const rows = msgs.map((m, i) => {
    const d = dateOf(new Date(m.createdAt));
    const prev = i > 0 ? dateOf(new Date(msgs[i - 1].createdAt)) : "";
    return { m, sep: d !== prev ? (d === today ? "Today" : fmtDate(d)) : null };
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#EFE7DD]"
      style={{ backgroundImage: "radial-gradient(rgba(120,90,60,.07) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
      <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-black/5 bg-[#F7F7F5]/95 px-3 pb-2.5 pt-[52px] backdrop-blur">
        <Link href="/app/phone/whatsapp" className="pr-1 text-[22px] leading-none text-[#1C8D4E]" aria-label="Back to chats">‹</Link>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#F2B07A] to-accent text-[12px] font-bold text-white">SD</span>
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-[15px]">Sunny Days Childcare</b>
          <span className="text-[12px] text-[#8E8E93]">Business account</span>
        </span>
        <Link href="/app/phone" className="text-[13px] font-semibold text-[#1C8D4E]">Home</Link>
      </header>

      <div className="flex-1 px-3 pb-24 pt-3">
        <div className="mx-auto mb-3 max-w-[290px] rounded-lg bg-[#FDF3C7] px-3 py-2 text-center text-[11.5px] leading-4 text-[#6E5F2E]">
          🔒 Messages from Sunny Days only say a report is ready. The details stay in the Littlelog app.
        </div>
        {rows.map(({ m, sep }) => {
          const href = m.kind === "incident" ? `/app/parent/incidents/${m.recordId}` : `/app/parent/report/${m.recordId}`;
          return (
            <div key={m.id}>
              {sep && <div className="my-3 flex justify-center"><span className="rounded-lg bg-white/80 px-3 py-1 text-[12px] font-semibold text-[#6B6B6B] shadow-sm">{sep}</span></div>}
              <div className="mb-2 max-w-[82%] rounded-[14px] rounded-tl-[4px] bg-white px-3 pb-1.5 pt-2 shadow-[0_1px_1px_rgba(0,0,0,.08)]">
                <p className="text-[14.5px] leading-[20px] text-[#111]">{m.body}</p>
                <Link href={href} className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border-t border-[#EFEFEF] pt-2 text-[14px] font-semibold text-[#1C8D4E]">
                  ↗ {m.kind === "incident" ? "Open incident report" : "Open in Littlelog"}
                </Link>
                <span className="mt-1 block text-right text-[11px] text-[#9A9A9A]">{fmtStamp(m.createdAt, { date: false })}</span>
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-[#8E8E93]">No messages yet.</p>}
      </div>

      <ScrollToBottom />
      <div className="fixed inset-x-0 bottom-0 flex items-center gap-2 bg-[#F7F7F5] px-3 pb-6 pt-2">
        <span className="flex-1 rounded-full border border-[#E3E3E3] bg-white px-4 py-2 text-[14px] text-[#B0B0B0]">This chat is notifications only</span>
      </div>
    </div>
  );
}
