import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { ageLabel, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";
import { PageHead } from "../ui";
import { Pagination } from "../Modal";

export default async function Children({ searchParams }: PageProps<"/director/children">) {
  const director = await requireUser("director");
  const { room: roomFilter, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const PAGE = 10;
  const db = await getDb();
  const today = todayStr();
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id));
  const all = await db.select({ child: s.children, room: s.rooms }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(eq(s.rooms.centerId, director.centerId))
    .orderBy(asc(s.rooms.id), asc(s.children.firstName));
  const links = await db.select({ childId: s.childParents.childId, name: s.users.name }).from(s.childParents)
    .innerJoin(s.users, eq(s.users.id, s.childParents.parentId));
  const query = typeof q === "string" ? q.toLowerCase() : "";
  const rows = all.filter(({ child, room }) =>
    (!roomFilter || String(room.id) === roomFilter) &&
    (!query || `${child.firstName} ${child.lastName}`.toLowerCase().includes(query)));

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Children" sub={`${all.length} children in ${rooms.length} rooms. Photos only show when a parent has given consent.`}
        action={<Link href="/director/enroll" className="btn btn-primary">＋ Enroll a child</Link>} />

      <form className="mt-5 flex flex-wrap items-center gap-2">
        {roomFilter && <input type="hidden" name="room" value={String(roomFilter)} />}
        <input name="q" defaultValue={query} placeholder="Search by name…" className="h-10 w-64 rounded-full border border-line bg-surface px-4 text-sm" />
        <Link href="/director/children" className={`rounded-full border px-4 py-2 text-sm font-semibold ${!roomFilter ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>All rooms</Link>
        {rooms.map((r) => (
          <Link key={r.id} href={`/director/children?room=${r.id}`}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${roomFilter === String(r.id) ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name}
          </Link>
        ))}
      </form>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-3">Child</th><th>Room</th><th>Age</th><th>Parents</th><th>Photo consent</th><th className="px-5" /></tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * PAGE, page * PAGE).map(({ child: c, room }) => (
              <tr key={c.id} className="border-t border-line hover:bg-surface-2/40">
                <td className="px-5 py-2.5">
                  <Link href={`/director/children/${c.id}`} className="flex items-center gap-3">
                    <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={34} />
                    <b>{c.firstName} {c.lastName}</b>
                  </Link>
                </td>
                <td><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: room.color }} />{room.name}</span></td>
                <td className="tabular text-ink-2">{ageLabel(c.dateOfBirth, today)}</td>
                <td className="text-ink-2">{links.filter((l) => l.childId === c.id).map((l) => l.name).join(", ") || <span className="text-danger">No parent linked</span>}</td>
                <td><span className={`badge ${c.photoConsent ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-3"}`}>{c.photoConsent ? "Yes" : "No"}</span></td>
                <td className="px-5 text-right"><Link href={`/director/children/${c.id}`} className="font-bold text-primary">Open →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-ink-3">No children match.</td></tr>}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(n) => {
              const p2 = new URLSearchParams();
              if (roomFilter) p2.set("room", String(roomFilter));
              if (query) p2.set("q", query);
              p2.set("page", String(n));
              return `/director/children?${p2}`;
            }} />
          </div>
        )}
      </div>

    </div>
  );
}
