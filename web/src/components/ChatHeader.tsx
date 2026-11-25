import Link from "next/link";
import type { threadMembers } from "@/lib/chat";
import { joinNames } from "@/lib/chat";
import { Avatar } from "./ui";
import { ROLE_TAG } from "./chat-tags";

type Members = Awaited<ReturnType<typeof threadMembers>>;

/** Sticky top of a phone chat: whose thread it is and everyone who can read it. */
export default function ChatHeader({ m, back, backLabel, call }: { m: Members; back?: string; backLabel?: string; call?: boolean }) {
  const { child, room } = m;
  const groups = [
    { role: "parent" as const, names: joinNames(m.parents.map((p) => p.name)) },
    { role: "teacher" as const, names: m.teachers.map((t) => t.name).join(", ") },
    { role: "director" as const, names: m.directors.map((d) => d.name).join(", ") },
  ].filter((g) => g.names);
  const phone = m.parents.find((p) => p.phone)?.phone;
  return (
    <div className="sticky top-[46px] z-30 border-b border-line bg-[rgba(251,247,240,.96)] px-[14px] pb-2.5 pt-1 backdrop-blur">
      {back && <Link href={back} className="text-sm font-bold text-primary">← {backLabel ?? "Chats"}</Link>}
      <div className="mt-1 flex items-center gap-3">
        <Avatar first={child.firstName} last={child.lastName} bg={child.avatarBg} fg={child.avatarFg} size={42} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-[19px] font-semibold leading-6">{child.firstName} {child.lastName}</div>
          <div className="text-[12px] text-ink-3">{room.name} Room · family chat</div>
        </div>
        {call && phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-bold text-primary">📞 Call</a>
        )}
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {groups.map((g) => (
          <span key={g.role} className={`flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TAG[g.role].cls}`}>
            <b className="text-[9.5px] uppercase tracking-[.06em]">{ROLE_TAG[g.role].label}</b> {g.names}
          </span>
        ))}
      </div>
    </div>
  );
}
