import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { joinNames } from "@/lib/chat";
import { fmtTime, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";
import { AppGlyph } from "@/components/NotificationBanners";

const CHANNEL_LABEL = { whatsapp: "WhatsApp", email: "Email", push: "App" } as const;

/**
 * "Sent!" sheet shown right after a teacher approves and sends reports.
 * It reads what really went out (the notifications rows), so it never claims more than happened.
 */
export default async function SentConfirm({ ids, teacherId, closeHref }: { ids: string | string[] | undefined; teacherId: number; closeHref: string }) {
  const childIds = (typeof ids === "string" ? ids : "").split(",").map(Number).filter(Boolean).slice(0, 40);
  if (!childIds.length) return null;
  const db = await getDb();
  const reports = await db.select({ r: s.dailyReports, c: s.children }).from(s.dailyReports)
    .innerJoin(s.children, eq(s.children.id, s.dailyReports.childId))
    .where(and(inArray(s.dailyReports.childId, childIds), eq(s.dailyReports.date, todayStr()), eq(s.dailyReports.status, "sent"), eq(s.dailyReports.approvedBy, teacherId)));
  if (!reports.length) return null;
  const notes = await db.select({ n: s.notifications, name: s.users.name }).from(s.notifications)
    .innerJoin(s.users, eq(s.users.id, s.notifications.parentId))
    .where(and(eq(s.notifications.kind, "daily_report"), inArray(s.notifications.recordId, reports.map((x) => x.r.id))));
  const one = reports.length === 1 ? reports[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Reports sent">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
      <div className="drop-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        <div className="text-center">
          <span className="pulse-ring relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-white">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h2 className="font-display mt-3 text-[26px] font-semibold leading-8">
            {one ? `${one.c.firstName}'s report is sent!` : `${reports.length} reports sent!`}
          </h2>
          <p className="mt-1 text-[13.5px] leading-5 text-ink-2">
            Sent at {fmtTime(reports[0].r.sentAt?.slice(11))}. The parents were notified and the director can see it.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          {reports.map(({ r, c }) => {
            const mine = notes.filter((x) => x.n.recordId === r.id);
            const parents = [...new Set(mine.map((x) => x.name))];
            const channels = [...new Set(mine.map((x) => x.n.channel))];
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={38} />
                <div className="min-w-0 flex-1">
                  <b className="text-[14px]">{c.firstName} {c.lastName}</b>
                  <div className="truncate text-[12px] text-ink-3">{parents.length ? `To ${joinNames(parents)}` : "No parent linked: nobody was notified"}</div>
                </div>
                <span className="flex gap-1" aria-label={channels.map((ch) => CHANNEL_LABEL[ch as keyof typeof CHANNEL_LABEL] ?? ch).join(", ")}>
                  {channels.map((ch) => <span key={ch} title={CHANNEL_LABEL[ch as keyof typeof CHANNEL_LABEL]}><AppGlyph channel={ch as "whatsapp" | "email" | "push"} size={22} /></span>)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[12px] text-ink-3">Entries for {one ? one.c.firstName : "these children"} are now locked.</p>

        <div className={`mt-4 grid gap-2 ${one ? "grid-cols-2" : ""}`}>
          {one && <Link href={`/app/teacher/reports/${one.c.id}`} className="btn btn-secondary">View report</Link>}
          <Link href={closeHref} scroll={false} className="btn btn-primary">Done</Link>
        </div>
      </div>
    </div>
  );
}
