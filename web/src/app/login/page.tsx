import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { DEMO_EMAIL, currentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Littlelog for directors" };

const ERRORS: Record<string, string> = {
  wrong: "That email and password don't match. Check for typos, or use the demo account below.",
  missing: "Please enter your email and password.",
};

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/director") ? sp.next : "/director";
  if (await currentUser("director")) redirect(next); // already signed in
  const db = await getDb();
  const [center] = await db.select().from(s.centers).limit(1);
  const [director] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.email, DEMO_EMAIL.director));
  const error = typeof sp.error === "string" ? ERRORS[sp.error] ?? ERRORS.wrong : null;

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* ------------------------------------------------ brand side */}
      <aside className="relative hidden overflow-hidden bg-[#24584E] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#2F6F62]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full bg-[#1D4A41]" />
        <div aria-hidden className="pointer-events-none absolute right-[18%] top-[38%] h-24 w-24 rounded-full bg-accent/90 blur-[2px]" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-[#F2B07A] to-accent shadow-[0_8px_20px_rgba(0,0,0,.2)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="13" r="4.2" fill="#fff" stroke="none" /><path d="M12 3.5v2M4.5 13h-2M21.5 13h-2M6.3 7.3 5 6M17.7 7.3 19 6M3 19h18" />
            </svg>
          </span>
          <span className="font-display text-[24px] font-semibold">Little<span className="italic text-[#F6C39A]">log</span></span>
        </Link>

        <div className="relative mt-auto max-w-[520px]">
          <h1 className="font-display text-[46px] font-semibold leading-[52px]">Every child&apos;s day, <span className="italic text-[#F6C39A]">beautifully told.</span></h1>
          <p className="mt-4 text-[16px] leading-7 text-white/80">
            Teachers speak, Littlelog writes the daily reports, and you see the whole center at a glance: attendance, reports, incidents and family chats.
          </p>

          {/* a small preview of what parents receive */}
          <div className="mt-8 w-[340px] rotate-[-2deg] rounded-[22px] bg-[#FBF7F0] p-4 text-ink shadow-[0_24px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FBEBD9] text-[12px] font-bold text-[#9A5414]">EC</span>
              <span className="leading-tight"><b className="block text-[14px]">Emma&apos;s day</b><span className="text-[11.5px] text-ink-3">Sunflower Room · sent 4:31 PM</span></span>
              <span className="ml-auto rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#2C6B42]">Sent</span>
            </div>
            <div className="mt-3 grid gap-1.5 text-[13px]">
              {[["🍎", "Lunch", "Pasta with veggies, ate it all"], ["🌙", "Nap", "12:00 – 1:30 PM"], ["🎨", "Activity", "Finger painting with a friend"]].map(([i, l, t]) => (
                <div key={l} className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1.5"><span>{i}</span><b className="text-[12px] text-ink-2">{l}</b><span className="truncate text-ink-2">{t}</span></div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[13.5px] text-white/75">
            {["Parents see only their own child", "Incidents need your approval", "Full audit log for licensing"].map((t) => (
              <span key={t} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[11px]">✓</span>{t}</span>
            ))}
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------ form side */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">☀</span>
            <span className="font-display text-[22px] font-semibold">Little<span className="italic text-accent">log</span></span>
          </Link>
          {sp.out === "1" && (
            <p className="drop-in mb-5 rounded-2xl bg-success-soft px-4 py-3 text-[13.5px] font-semibold text-[#2C6B42]">✓ You&apos;re signed out. See you soon!</p>
          )}
          <div className="eyebrow">Director sign-in</div>
          <h2 className="font-display mt-1 text-[36px] font-semibold leading-[42px]">Welcome back{director ? `, ${director.name.split(" ")[0]}` : ""}</h2>
          <p className="mb-7 mt-1.5 text-[15px] text-ink-2">Sign in to manage {center?.name ?? "your center"}.</p>

          <LoginForm email={typeof sp.email === "string" ? sp.email : ""} next={next} error={error}
            demoEmail={DEMO_EMAIL.director} demoPassword={process.env.DEMO_PASSWORD ?? "demo1234"} />

          <div className="mt-8 border-t border-line pt-5 text-center text-[13.5px] text-ink-2">
            Teacher or parent? Use the phone apps:
            <span className="mt-2 flex justify-center gap-2">
              <Link href="/teacher" className="rounded-full border border-line bg-surface px-3.5 py-1.5 font-bold hover:border-primary hover:text-primary">📱 Teacher app</Link>
              <Link href="/parent" className="rounded-full border border-line bg-surface px-3.5 py-1.5 font-bold hover:border-primary hover:text-primary">📱 Parent app</Link>
            </span>
          </div>
          <p className="mt-6 text-center text-[11.5px] text-ink-3">Portfolio demo · sample data only · no real children&apos;s information</p>
        </div>
      </main>
    </div>
  );
}
