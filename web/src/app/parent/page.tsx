import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import SimHeader, { Steps } from "@/components/SimHeader";
import ViewAsSwitcher from "@/components/ViewAsSwitcher";
import { currentUser } from "@/lib/session";
import { centerTz } from "@/lib/time";
import { parentOptions } from "@/lib/demo";

export const metadata = { title: "Parent app · Littlelog demo" };

export default async function ParentSimulator() {
  const parent = await currentUser("parent");
  const options = await parentOptions(parent?.id);
  const current = parent?.id ?? options[0]?.id ?? null;
  const name = options.find((o) => o.id === current)?.name ?? "Sarah Carter";

  return (
    <main className="min-h-screen bg-[#EDE6DA] px-6 py-8">
      <SimHeader active="parent" />
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start justify-center gap-12">
        <div className="grid justify-items-center gap-3">
          <ViewAsSwitcher role="parent" current={current} options={options} back="/parent" />
          <PhoneFrame tz={centerTz()} src="/app/phone" home="/app/phone" label={`Parent · ${name}`} />
        </div>
        <aside className="w-full max-w-[320px] pt-2">
          <h1 className="font-display text-[34px] font-semibold leading-10">Parent app</h1>
          <p className="mb-6 mt-2 text-[15px] leading-6 text-ink-2">
            Parents get a warm note about their own child every afternoon, and never see anyone else&apos;s child.
          </p>
          <Steps title="Try this" steps={[
            { text: "The phone opens on its home screen. Red badges show unread messages in Littlelog, WhatsApp and Mail." },
            { text: "Tap WhatsApp to read the daycare's chat, or Mail for the emails. Each message opens the report in Littlelog." },
            { text: "Tap the bar at the bottom of the phone to go back to the home screen." },
            { text: "In Littlelog, as Sarah Carter, switch between Emma and Leo at the top." },
            { text: "Open Incidents and tap “I've read this report” on Leo's incident." },
            { text: "When a teacher sends reports, WhatsApp, Mail and Littlelog notifications slide in here." },
            { text: "Switch to Owen's parent above the phone, then approve Owen's incident in the director app and watch it arrive." },
          ]} />
          <div className="mt-6 rounded-2xl bg-accent-soft p-4 text-[13px] leading-5 text-ink-2">
            <b className="text-ink">Added a new family?</b> In the director app, open the parent and click
            “View as parent ↗”. They will appear in the switcher above.
          </div>
          <div className="mt-4 grid gap-2">
            <Link href="/teacher" className="btn btn-sm btn-secondary">← Send reports from the teacher&apos;s phone</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
