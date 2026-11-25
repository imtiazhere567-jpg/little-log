import Link from "next/link";
import { resetDemo } from "./actions";

const cards = [
  {
    href: "/teacher",
    eyebrow: "Mobile app · Ms. Sara",
    title: "Teacher",
    text: "Record a voice note, watch the AI sort it by child, then approve and send today's reports.",
    tint: "bg-accent-soft",
    icon: "🎙️",
  },
  {
    href: "/parent",
    eyebrow: "Mobile app · Sarah Carter",
    title: "Parent",
    text: "Get the 4:30 PM report by WhatsApp, email and app notification. Two children: Emma and Leo.",
    tint: "bg-surface",
    icon: "💌",
  },
  {
    href: "/director",
    eyebrow: "Desktop app · Maria Bennett",
    title: "Director",
    text: "See the whole center, approve or reject incidents, and get a red alert for serious ones.",
    tint: "bg-primary-soft",
    icon: "🗂️",
  },
];

export default function Launcher() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="eyebrow">Portfolio demo · Sunny Days Childcare</div>
          <h1 className="font-display mt-3 text-6xl font-semibold leading-[1.02] md:text-7xl">
            Little<span className="italic text-accent">log</span>
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink-2">
            Teachers speak short voice notes during the day. The AI sorts them by child and writes
            each parent a warm daily report. Incidents wait for the director&apos;s approval.
          </p>
        </div>
        <Link href="/demo" className="btn btn-lg btn-primary shrink-0">
          ▶ Watch the full story
        </Link>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className={`card group flex min-h-[260px] flex-col justify-between p-7 transition hover:-translate-y-1 hover:shadow-[var(--shadow-2)] ${c.tint}`}
          >
            <div>
              <div className="text-3xl">{c.icon}</div>
              <div className="eyebrow mt-5">{c.eyebrow}</div>
              <h2 className="font-display mt-1 text-3xl font-semibold">{c.title}</h2>
              <p className="mt-3 text-[15px] leading-6 text-ink-2">{c.text}</p>
            </div>
            <span className="mt-6 font-bold text-primary group-hover:underline">Open {c.title.toLowerCase()} app →</span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4 rounded-[20px] border border-dashed border-line p-6 text-sm text-ink-2 md:flex-row md:items-center md:justify-between">
        <p>
          <b className="text-ink">Demo mode.</b> Everything uses sample data. Voice notes play pre-written
          transcripts, and WhatsApp, email and app notifications are simulated inside the parent&apos;s phone.
        </p>
        <form action={resetDemo}>
          <button className="btn btn-sm btn-secondary">↺ Reset demo data</button>
        </form>
      </div>
    </main>
  );
}
