import PhoneFrame from "@/components/PhoneFrame";
import SimHeader, { Steps } from "@/components/SimHeader";
import ViewAsSwitcher from "@/components/ViewAsSwitcher";
import { currentUser } from "@/lib/session";
import { centerTz } from "@/lib/time";
import { parentOptions, teacherOptions } from "@/lib/demo";

export const metadata = { title: "Full story · Littlelog demo" };

export default async function Demo() {
  const [teacher, parent] = await Promise.all([currentUser("teacher"), currentUser("parent")]);
  const [tOpts, pOpts] = await Promise.all([teacherOptions(teacher?.id), parentOptions(parent?.id)]);
  const tCur = teacher?.id ?? tOpts[0]?.id ?? null;
  const pCur = parent?.id ?? pOpts[0]?.id ?? null;

  return (
    <main className="min-h-screen bg-[#EDE6DA] px-6 py-8">
      <SimHeader active="both" />
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start justify-center gap-10">
        <div className="grid justify-items-center gap-3">
          <ViewAsSwitcher role="teacher" current={tCur} options={tOpts} back="/demo" />
          <PhoneFrame tz={centerTz()} src="/app/teacher" label={`Teacher · ${tOpts.find((o) => o.id === tCur)?.name ?? ""}`} />
        </div>
        <div className="grid justify-items-center gap-3">
          <ViewAsSwitcher role="parent" current={pCur} options={pOpts} back="/demo" />
          <PhoneFrame tz={centerTz()} src="/app/phone" home="/app/phone" label={`Parent · ${pOpts.find((o) => o.id === pCur)?.name ?? ""}`} />
        </div>
        <aside className="w-full max-w-[300px] pt-4">
          <Steps title="Try the full story" steps={[
            { who: "Teacher", text: "Tap the orange mic, pick a demo note and record it." },
            { who: "Teacher", text: "Check the AI results. Pick the right child if a name is unclear, then save." },
            { who: "Teacher", text: "Open Reports and tap “Approve & send”." },
            { who: "Parent", text: "Watch WhatsApp, email and app notifications arrive. Tap one to read the report." },
            { who: "Director", text: "Open the director app to approve an incident. The parent is notified only after approval." },
          ]} />
          <p className="mt-6 rounded-2xl bg-surface p-4 text-[13px] leading-5 text-ink-2">
            Privacy rule in action: Emma&apos;s parent never sees another child&apos;s name. “Emma and Henry did finger
            painting” becomes “Finger painting with a friend”.
          </p>
        </aside>
      </div>
    </main>
  );
}
