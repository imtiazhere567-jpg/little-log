import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { assertUser, audit, requireUser } from "@/lib/session";
import { markReadServer } from "@/lib/notify-read";
import { parentChildren } from "@/lib/data";
import { fmtDate, fmtTime, nowStamp } from "@/lib/time";

async function acknowledge(fd: FormData) {
  "use server";
  const parent = await assertUser("parent");
  const id = Number(fd.get("id"));
  const db = await getDb();
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, id));
  const kids = await parentChildren(parent.id);
  if (!inc || inc.status !== "approved" || !kids.some((k) => k.child.id === inc.childId)) throw new Error("Not allowed");
  await db.update(s.incidents).set({ parentAckAt: nowStamp() }).where(eq(s.incidents.id, id));
  await audit(parent.id, "acknowledged", "incidents", id);
  revalidatePath("/app/parent", "layout");
}

export default async function ParentIncident({ params }: PageProps<"/app/parent/incidents/[id]">) {
  const parent = await requireUser("parent");
  const { id } = await params;
  const db = await getDb();
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, Number(id)));
  const kids = await parentChildren(parent.id);
  const mine = kids.find((k) => k.child.id === inc?.childId);
  if (!inc || !mine || inc.status !== "approved") notFound();
  const [staff] = await db.select().from(s.users).where(eq(s.users.id, inc.staffId));
  await audit(parent.id, "viewed", "incidents", inc.id);
  await markReadServer(parent.id, { channel: "push", recordId: inc.id, kind: "incident" });

  const rows: [string, string][] = [
    ["Date", fmtDate(inc.date)], ["Time", fmtTime(inc.time)], ["Location", inc.location],
    ["What happened", inc.description], ["Injury", inc.injury], ["Body part", inc.bodyPart],
    ["First aid / action taken", inc.actionTaken], ["Staff present", staff?.name ?? ""],
  ];

  return (
    <div className="px-[18px]">
      <div className="mt-1 rounded-3xl border-l-[5px] border-danger bg-danger-soft p-5">
        <div className="eyebrow text-danger">Incident report · approved by the director</div>
        <h1 className="font-display mt-1 text-[24px] font-semibold leading-[29px]">{mine.child.firstName} {mine.child.lastName}</h1>
        <dl className="mt-4 grid gap-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{k}</dt>
              <dd className="text-[15px] leading-[21px]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {inc.parentAckAt ? (
        <p className="mt-4 text-center text-sm text-ink-2">✓ You confirmed you read this report.</p>
      ) : (
        <form action={acknowledge} className="mt-4">
          <input type="hidden" name="id" value={inc.id} />
          <button className="btn btn-lg btn-primary w-full">I&apos;ve read this report</button>
        </form>
      )}
      <p className="mt-3 text-center text-xs text-ink-3">Questions? Call Sunny Days Childcare at +1 555 0100.</p>
    </div>
  );
}
