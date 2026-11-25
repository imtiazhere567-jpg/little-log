import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canChat, markThreadRead, threadMembers, threadMessages } from "@/lib/chat";
import { centerTz } from "@/lib/time";
import ChatThread from "@/components/ChatThread";
import ChatHeader from "@/components/ChatHeader";

export default async function TeacherChat({ params }: PageProps<"/app/teacher/chat/[childId]">) {
  const { childId } = await params;
  const teacher = await requireUser("teacher", `/app/teacher/chat/${childId}`);
  const id = Number(childId);
  if (!(await canChat(teacher, id))) notFound();
  const [members, messages] = await Promise.all([threadMembers(id), threadMessages(id)]);
  await markThreadRead(teacher.id, id);
  return (
    <div className="-mt-1">
      <ChatHeader m={members} back="/app/teacher/chat" call />
      <ChatThread role="teacher" childId={id} childFirst={members.child.firstName} meId={teacher.id} initial={messages} tz={centerTz()} />
    </div>
  );
}
