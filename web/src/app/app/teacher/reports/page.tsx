import Link from "next/link";
import { requireUser } from "@/lib/session";
import { pickTeacherRoom, roomDay } from "@/lib/data";
import { fmtDate, fmtTime, todayStr } from "@/lib/time";
import { Avatar, Badge, STATUS } from "@/components/ui";
import { sendReports } from "../actions";
import SentConfirm from "../SentConfirm";

export default async function ReportsReview({ searchParams }: PageProps<"/app/teacher/reports">) {
  const teacher = await requireUser("teacher");
  const sp = await searchParams;
  const { room } = await pickTeacherRoom(teacher.id);
  if (!room) return <p className="p-6">No room assigned.</p>;
  const today = todayStr();
  const day = await roomDay(room.id, today);
  const ready = day.children.filter((c) => c.status === "ready");
  const order = { review: 0, ready: 1, few: 2, sent: 3 } as const;
  const list = [...day.children].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="px-[18px]">
      <div className="eyebrow mt-1.5">{fmtDate(today)} · {room.name} Room</div>
      <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-[35px]">Daily reports</h1>
      <p className="mt-1 text-sm text-ink-2">
        The AI drafts each report from today&apos;s entries. Check them, then send. Parents get WhatsApp, email and an app notification.
      </p>

      <form action={sendReports} className="mt-4">
        <input type="hidden" name="childIds" value={ready.map((r) => r.child.id).join(",")} />
        <input type="hidden" name="back" value="/app/teacher/reports" />
        <button disabled={!ready.length} className="btn btn-lg btn-primary w-full">
          {ready.length ? `Approve & send ${ready.length} ready ${ready.length === 1 ? "report" : "reports"}` : "No reports ready yet"}
        </button>
      </form>

      <div className="mt-5 grid gap-2.5">
        {list.map(({ child: c, entries, status, report }) => (
          <Link key={c.id} href={`/app/teacher/reports/${c.id}`}
            className="flex items-center gap-3 rounded-[20px] border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-1)]">
            <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={42} dot={STATUS[status].dot} />
            <div className="min-w-0">
              <div className="font-display text-[17px] font-semibold">{c.firstName} {c.lastName}</div>
              <div className="text-xs text-ink-3">
                {status === "sent" && report?.sentAt ? `Sent at ${fmtTime(report.sentAt.slice(11))}`
                  : status === "review" ? "An unclear name may belong to this child"
                  : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} today`}
              </div>
            </div>
            <span className="ml-auto flex items-center gap-2"><Badge status={status} /><span className="text-ink-3">›</span></span>
          </Link>
        ))}
      </div>
      <SentConfirm ids={sp.sent} teacherId={teacher.id} closeHref="/app/teacher/reports" />
    </div>
  );
}
