import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parentChildren } from "@/lib/data";
import { fmtDate, fmtTime } from "@/lib/time";
import { Avatar, WarnIcon } from "@/components/ui";

export default async function ParentIncidents() {
  const parent = await requireUser("parent");
  const kids = await parentChildren(parent.id);
  const db = await getDb();
  // Only approved incidents ever reach a parent.
  const list = kids.length ? await db.select().from(s.incidents)
    .where(and(inArray(s.incidents.childId, kids.map((k) => k.child.id)), eq(s.incidents.status, "approved")))
    .orderBy(desc(s.incidents.date), desc(s.incidents.time)) : [];
  const childOf = new Map(kids.map((k) => [k.child.id, k.child]));

  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-3 text-[30px] font-semibold leading-[35px]">Incident reports</h1>
      <p className="mt-1 text-sm text-ink-2">Every report here was reviewed and approved by the director.</p>
      <div className="mt-4 grid gap-2.5">
        {list.map((i) => {
          const c = childOf.get(i.childId)!;
          return (
            <Link key={i.id} href={`/app/parent/incidents/${i.id}`} className="card flex items-center gap-3 p-3.5">
              <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={42} />
              <div className="min-w-0">
                <b className="block text-[15px]">{c.firstName} · {i.injury}</b>
                <span className="text-[13px] text-ink-2">{fmtDate(i.date)} · {fmtTime(i.time)}</span>
              </div>
              {i.parentAckAt ? (
                <span className="badge ml-auto bg-surface-2 text-ink-3">Read</span>
              ) : (
                <span className="badge ml-auto bg-danger text-white"><WarnIcon size={11} /> New</span>
              )}
            </Link>
          );
        })}
        {list.length === 0 && <p className="py-8 text-center text-sm text-ink-3">No incident reports. 🌿</p>}
      </div>
    </div>
  );
}
