import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { markReadServer } from "@/lib/notify-read";
import { fmtStamp } from "@/lib/time";

/** One email from the daycare. Opening it marks it read; the button opens Littlelog. */
export default async function MailMessage({ params }: PageProps<"/app/phone/mail/[id]">) {
  const parent = await requireUser("parent", "/app/phone");
  const { id } = await params;
  const db = await getDb();
  const [m] = await db.select().from(s.notifications)
    .where(and(eq(s.notifications.id, Number(id)), eq(s.notifications.parentId, parent.id), eq(s.notifications.channel, "email")));
  if (!m) notFound();
  await markReadServer(parent.id, { id: m.id });
  const href = m.kind === "incident" ? `/app/parent/incidents/${m.recordId}` : `/app/parent/report/${m.recordId}`;

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-[#EDEDED] px-4 pb-3 pt-[54px]">
        <Link href="/app/phone/mail" className="text-[15px] font-semibold text-[#3D7BE0]">‹ Inbox</Link>
        <Link href="/app/phone" className="text-[13px] font-semibold text-[#3D7BE0]">Home</Link>
      </header>
      <article className="px-5 py-5">
        <h1 className="text-[21px] font-bold leading-7">{m.title}</h1>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#F2B07A] to-accent text-[13px] font-bold text-white">SD</span>
          <span className="min-w-0 flex-1 leading-tight">
            <b className="block text-[15px]">Sunny Days Childcare</b>
            <span className="text-[12.5px] text-[#8E8E93]">to {parent.email}</span>
          </span>
          <span className="text-[12.5px] text-[#8E8E93]">{fmtStamp(m.createdAt)}</span>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#EFE7DC]">
          <div className="h-1.5 bg-gradient-to-r from-accent to-[#F2C27B]" />
          <div className="bg-[#FFFCF7] px-5 py-6">
            <div className="font-display text-[22px] font-semibold">Little<span className="italic text-accent">log</span></div>
            <p className="mt-4 text-[15px] leading-[23px] text-[#333]">{m.body}</p>
            <Link href={href} className="mt-5 flex h-12 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-white">
              {m.kind === "incident" ? "Read the incident report" : "View report"}
            </Link>
            <p className="mt-5 text-[12px] leading-[18px] text-[#9A9088]">
              For your child&apos;s privacy, reports are only shown inside the Littlelog app after you sign in.
              You get this email because you are a parent at Sunny Days Childcare.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
