import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canChat, markThreadRead, threadMembers, threadMessages } from "@/lib/chat";
import { centerTz } from "@/lib/time";
import ChatThread from "@/components/ChatThread";
import ChatHeader from "@/components/ChatHeader";

export default async function ParentChat({ params }: PageProps<"/app/parent/chat/[childId]">) {
  const { childId } = await params;
  const parent = await requireUser("parent", `/app/parent/chat/${childId}`);
  const id = Number(childId);
  if (!(await canChat(parent, id))) notFound();
  const [members, messages] = await Promise.all([threadMembers(id), threadMessages(id)]);
  await markThreadRead(parent.id, id);
  return (
    <div className="-mt-1">
      <ChatHeader m={members} />
      <ChatThread role="parent" childId={id} childFirst={members.child.firstName} meId={parent.id} initial={messages} tz={centerTz()} />
    </div>
  );
}
