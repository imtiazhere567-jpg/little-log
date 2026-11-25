import Link from "next/link";
import { requireUser } from "@/lib/session";
import { teacherRooms } from "@/lib/data";

export default async function Me() {
  const teacher = await requireUser("teacher");
  const rooms = await teacherRooms(teacher.id);
  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-3 text-[30px] font-semibold">Me</h1>
      <div className="card mt-4 flex items-center gap-3 p-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-lg font-bold text-white">
          {teacher.name.replace("Ms. ", "").slice(0, 2).toUpperCase()}
        </span>
        <div>
          <div className="font-display text-xl font-semibold">{teacher.name}</div>
          <div className="text-sm text-ink-2">{teacher.email}</div>
        </div>
      </div>
      <div className="eyebrow mb-2 mt-6">My rooms</div>
      <div className="grid gap-2">
        {rooms.map((r) => (
          <Link key={r.id} href={`/app/teacher?room=${r.id}`} className="card flex items-center gap-3 p-4">
            <span className="h-4 w-4 rounded-full" style={{ background: r.color }} />
            <b>{r.name} Room</b>
            <span className="text-sm text-ink-3">{r.ageGroup}</span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink-3">Littlelog demo · Sunny Days Childcare</p>
    </div>
  );
}
