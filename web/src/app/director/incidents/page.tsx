import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { fmtDate, fmtTime } from "@/lib/time";
import { Avatar, Badge } from "@/components/ui";
import { Pagination } from "../Modal";

const TABS = [
  { key: "draft", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export default async function IncidentsQueue({ searchParams }: PageProps<"/director/incidents">) {
  await requireUser("director");
  const { tab = "draft", done, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const PAGE = 10;
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const db = await getDb();
  const rows = await db.select({ inc: s.incidents, child: s.children, room: s.rooms }).from(s.incidents)
    .innerJoin(s.children, eq(s.children.id, s.incidents.childId))
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .orderBy(desc(s.incidents.date), desc(s.incidents.time));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, rows.filter((r) => r.inc.status === t.key).length]));
  const all = rows.filter((r) => r.inc.status === current.key);
  const list = all.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="w-full max-w-[1760px]">
      <h1 className="font-display text-[34px] font-semibold">Incidents</h1>
      <p className="mt-1 text-ink-2">Drafts come from teachers&apos; voice notes. Parents only see an incident after you approve it.</p>
      {done && (
        <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
          {done === "approve" ? "✓ Approved. The parents have been notified by WhatsApp, email and app notification." : "Incident rejected. Parents were not notified."}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/director/incidents?tab=${t.key}`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${t.key === current.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
            {t.label} <span className="opacity-60">{counts[t.key]}</span>
          </Link>
        ))}
      </div>
      <div className="card mt-4 divide-y divide-line">
        {list.map(({ inc, child, room }) => (
          <Link key={inc.id} href={`/director/incidents/${inc.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2/50">
            <Avatar first={child.firstName} last={child.lastName} bg={child.avatarBg} fg={child.avatarFg} size={42} />
            <div className="min-w-0">
              <b className="block">{child.firstName} {child.lastName} · {inc.injury}</b>
              <span className="text-sm text-ink-2">{fmtDate(inc.date)} · {fmtTime(inc.time)} · {inc.location} · {room.name} Room</span>
            </div>
            <span className="ml-auto flex items-center gap-2">
              {inc.isSerious && <span className="badge bg-danger text-white">Serious</span>}
              {inc.status === "approved" && <span className="badge bg-surface-2 text-ink-3">{inc.parentAckAt ? "Parent read it" : "Not read yet"}</span>}
              <Badge status={inc.status === "draft" ? "awaiting" : inc.status} />
            </span>
          </Link>
        ))}
        {list.length === 0 && <p className="p-8 text-center text-sm text-ink-3">Nothing here.</p>}
      </div>
      {all.length > 0 && (
        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE} total={all.length} hrefFor={(n) => `/director/incidents?tab=${current.key}&page=${n}`} />
        </div>
      )}
    </div>
  );
}
