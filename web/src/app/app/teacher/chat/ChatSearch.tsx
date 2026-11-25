import Link from "next/link";

/** Search by child or parent name, plus an "Unread" filter. Plain GET form, no client JS needed. */
export default function ChatSearch({ q, unreadOnly, unread }: { q: string; unreadOnly: boolean; unread: number }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <form className="min-w-0 flex-1">
        {unreadOnly && <input type="hidden" name="show" value="unread" />}
        <input name="q" defaultValue={q} placeholder="Search child or parent…" aria-label="Search chats"
          className="h-10 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-primary" />
      </form>
      <Link href={unreadOnly ? `/app/teacher/chat${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/app/teacher/chat?show=unread${q ? `&q=${encodeURIComponent(q)}` : ""}`}
        scroll={false}
        className={`flex h-10 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold ${unreadOnly ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-2"}`}>
        Unread {unread > 0 && <span className={`rounded-full px-1.5 text-[11px] ${unreadOnly ? "bg-white/25" : "bg-primary text-white"}`}>{unread}</span>}
      </Link>
    </div>
  );
}
