import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { fmtTime, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";
import { resolveReview, skipReview } from "./actions";

/** Unclear-name entries from today that might belong to this child. */
export async function reviewsFor(childId: number, roomId: number) {
  const db = await getDb();
  const rows = await db.select().from(s.logEntries).where(and(
    eq(s.logEntries.roomId, roomId), eq(s.logEntries.date, todayStr()),
    eq(s.logEntries.needsReview, true), isNull(s.logEntries.childId)));
  return rows.filter((r) => (r.candidateIds ?? "").split(",").map(Number).includes(childId));
}

/**
 * "Is this Samantha?" — shown on a child's report preview and day page when a voice note
 * mentioned a name that matches more than one child. The teacher answers in one tap.
 */
export default async function ReviewPrompt({ childId, firstName, roomId }: { childId: number; firstName: string; roomId: number }) {
  const reviews = await reviewsFor(childId, roomId);
  if (!reviews.length) return null;
  const db = await getDb();
  const kids = await db.select().from(s.children).where(eq(s.children.roomId, roomId));
  const notes = await db.select().from(s.voiceNotes).where(eq(s.voiceNotes.roomId, roomId));

  return (
    <div className="grid gap-2.5">
      {reviews.map((r) => {
        const cands = (r.candidateIds ?? "").split(",").map(Number).map((id) => kids.find((k) => k.id === id)).filter(Boolean);
        const me = cands.find((k) => k!.id === childId)!;
        const others = cands.filter((k) => k!.id !== childId);
        const note = notes.find((n) => n.id === r.voiceNoteId);
        const quote = note?.transcript.split(/(?<=\.)\s+/).find((sentence) => sentence.includes(r.mentionedName ?? "\u0000")) ?? r.details;
        return (
          <div key={r.id} className="rounded-[20px] border border-line border-l-4 border-l-warning bg-surface p-4 shadow-[var(--shadow-1)]">
            <div className="flex items-center gap-2 text-[15px] font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-warning-soft text-[13px] font-extrabold text-warning">?</span>
              Is this {firstName}?
            </div>
            <p className="mt-1.5 text-[13.5px] leading-5 text-ink-2">
              Your {note ? fmtTime(note.time) : fmtTime(r.time)} note said <i className="text-ink">“{quote.trim()}”</i>.
              “{r.mentionedName}” matches {cands.length} children, so the AI didn&apos;t guess.
            </p>
            <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
              Entry waiting: <b>{r.label ? `${r.label} · ` : ""}{r.details}</b>
            </div>
            <div className="mt-3 grid gap-2">
              <form action={resolveReview}>
                <input type="hidden" name="entryId" value={r.id} />
                <input type="hidden" name="childId" value={childId} />
                <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-bold text-white">
                  <Avatar first={me.firstName} last={me.lastName} bg={me.avatarBg} fg={me.avatarFg} size={24} />
                  Yes, it&apos;s {firstName}
                </button>
              </form>
              <div className="flex gap-2">
                {others.map((k) => (
                  <form key={k!.id} action={resolveReview} className="flex-1">
                    <input type="hidden" name="entryId" value={r.id} />
                    <input type="hidden" name="childId" value={k!.id} />
                    <button className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 text-[13px] font-semibold">
                      No, it&apos;s {k!.firstName}
                    </button>
                  </form>
                ))}
                <form action={skipReview}>
                  <input type="hidden" name="entryId" value={r.id} />
                  <button className="h-10 rounded-xl px-3 text-[13px] font-semibold text-ink-3" title="Delete this entry">Skip</button>
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
