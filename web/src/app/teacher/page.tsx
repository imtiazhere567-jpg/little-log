import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import SimHeader, { Steps } from "@/components/SimHeader";
import ViewAsSwitcher from "@/components/ViewAsSwitcher";
import { currentUser } from "@/lib/session";
import { centerTz } from "@/lib/time";
import { teacherOptions } from "@/lib/demo";

export const metadata = { title: "Teacher app · Littlelog demo" };

export default async function TeacherSimulator() {
  const teacher = await currentUser("teacher");
  const options = await teacherOptions(teacher?.id);
  const current = teacher?.id ?? options[0]?.id ?? null;
  const name = options.find((o) => o.id === current)?.name ?? "Ms. Sara";

  return (
    <main className="min-h-screen bg-[#EDE6DA] px-6 py-8">
      <SimHeader active="teacher" />
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start justify-center gap-12">
        <div className="grid justify-items-center gap-3">
          <ViewAsSwitcher role="teacher" current={current} options={options} back="/teacher" />
          <PhoneFrame tz={centerTz()} src="/app/teacher" label={`Teacher · ${name}`} />
        </div>
        <aside className="w-full max-w-[320px] pt-2">
          <h1 className="font-display text-[34px] font-semibold leading-10">Teacher app</h1>
          <p className="mb-6 mt-2 text-[15px] leading-6 text-ink-2">
            Teachers have one hand free and 20 seconds. They speak, the AI writes it down for each child.
          </p>
          <Steps title="Try this" steps={[
            { text: "On Today, answer “Who is Sam?” by tapping the right child." },
            { text: "Tap the orange mic, pick “A fall on the playground” and tap the round button once." },
            { text: "Check the AI results, pick the right “Sam”, then Save." },
            { text: "Open Reports and tap “Approve & send”." },
            { text: "Switch to Ms. Leah above the phone to see a teacher with two rooms." },
          ]} />
          <div className="mt-6 grid gap-2">
            <Link href="/parent" className="btn btn-sm btn-secondary">See it on the parent&apos;s phone →</Link>
            <Link href="/director" target="_blank" className="btn btn-sm btn-ghost">Approve the incident in the director app ↗</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
