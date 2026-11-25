import { requireUser } from "@/lib/session";
import { pickTeacherRoom, roomDay } from "@/lib/data";
import { SAMPLES } from "@/lib/samples";
import { centerTz, todayStr } from "@/lib/time";
import GroupRecorder from "./GroupRecorder";
import ChildRecorder from "./ChildRecorder";

export default async function RecordPage({ searchParams }: PageProps<"/app/teacher/record">) {
  const teacher = await requireUser("teacher");
  const sp = await searchParams;
  const { room } = await pickTeacherRoom(teacher.id, typeof sp.room === "string" ? sp.room : undefined);
  if (!room) return <p className="p-6">No room assigned.</p>;

  // demo: several children in one note (shows name matching and "needs review")
  if (sp.mode === "group") {
    return <GroupRecorder roomId={room.id} roomName={room.name}
      samples={SAMPLES.map(({ id, title, hint, transcript }) => ({ id, title, hint, transcript }))} />;
  }

  // normal: pick the child first, then speak or type
  const day = await roomDay(room.id, todayStr());
  return (
    <ChildRecorder
      roomName={room.name}
      tz={centerTz()}
      preselect={Number(sp.child) || undefined}
      kids={day.children.map(({ child: c, entries, status }) => ({
        id: c.id, firstName: c.firstName, lastName: c.lastName, avatarBg: c.avatarBg, avatarFg: c.avatarFg, entries: entries.length, status,
      }))}
    />
  );
}
