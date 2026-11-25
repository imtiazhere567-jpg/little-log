import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { Child, Room } from "@/lib/data";

export default function ChildSwitcher({ kids, current, base }: {
  kids: { child: Child; room: Room }[]; current: number; base: string;
}) {
  if (kids.length < 2) return null;
  return (
    <div className="mt-3 flex gap-2">
      {kids.map(({ child: c }) => (
        <Link key={c.id} href={`${base}?child=${c.id}`}
          className={`flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-bold ${c.id === current ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
          <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={32} />
          {c.firstName}
        </Link>
      ))}
    </div>
  );
}
