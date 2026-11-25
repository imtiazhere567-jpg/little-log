import Link from "next/link";
import type { Thread } from "@/lib/chat";
import { dateOf, fmtStamp, todayStr } from "@/lib/time";
import { Avatar } from "./ui";
import { RoleTag } from "./chat-tags";

export function lastWhen(iso: string) {
  return dateOf(new Date(iso)) === todayStr() ? fmtStamp(iso, { date: false }) : fmtStamp(iso, { time: false });
}

/** Phone list of chat threads. `subtitle` says who is in each thread from this person's point of view. */
export default function ChatList({ threads, base, subtitle, empty }: {
  threads: Thread[]; base: string; subtitle: (t: Thread) => string; empty: string;
}) {
  if (!threads.length) return <p className="card mt-4 p-5 text-center text-sm text-ink-3">{empty}</p>;
  return (
    <div className="mt-3 grid grid-cols-1 gap-2">
      {threads.map((t) => (
        <Link key={t.child.id} href={`${base}/${t.child.id}`}
          className={`flex min-w-0 items-center gap-3 rounded-[20px] border bg-surface px-3.5 py-3 shadow-[var(--shadow-1)] ${t.unread ? "border-primary/40" : "border-line"}`}>
          <Avatar first={t.child.firstName} last={t.child.lastName} bg={t.child.avatarBg} fg={t.child.avatarFg} size={46} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <b className="truncate text-[15px]">{t.child.firstName} {t.child.lastName}</b>
              {t.last && <span className={`flex-none text-[11.5px] ${t.unread ? "font-bold text-primary" : "text-ink-3"}`}>{lastWhen(t.last.createdAt)}</span>}
            </span>
            <span className="block truncate text-[12px] text-ink-3">{subtitle(t)}</span>
            <span className="mt-0.5 flex items-center gap-1.5">
              {t.last ? <>
                <RoleTag role={t.last.role} small />
                <span className={`min-w-0 flex-1 truncate text-[13px] ${t.unread ? "font-semibold text-ink" : "text-ink-2"}`}>{t.last.body}</span>
              </> : <span className="text-[13px] text-ink-3">No messages yet · tap to start</span>}
              {t.unread > 0 && <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-white">{t.unread}</span>}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
