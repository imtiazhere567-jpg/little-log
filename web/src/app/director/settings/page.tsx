import Link from "next/link";
import { BrandField } from "@/components/BrandPicker";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { fmtTime } from "@/lib/time";
import { resetDemoFromSettings } from "@/app/actions";
import { saveSettings } from "../manage-actions";
import { Field, PageHead, Saved, Toggle, inputCls } from "../ui";

const SECTIONS = [
  { key: "general", label: "General", hint: "Center details & time zone", icon: "🏫" },
  { key: "hours", label: "Hours", hint: "Opening times & school days", icon: "🕘" },
  { key: "reports", label: "Daily reports", hint: "Send time, review, tone", icon: "📄" },
  { key: "notifications", label: "Notifications", hint: "WhatsApp, email, app, SMS", icon: "🔔" },
  { key: "incidents", label: "Incidents", hint: "Approval & reminders", icon: "⚠️" },
  { key: "privacy", label: "Privacy & data", hint: "Recordings, retention, consent", icon: "🔒" },
  { key: "demo", label: "Demo", hint: "Reset the sample data", icon: "🧪" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const ZONES = [
  ["America/New_York", "US Eastern (New York)"], ["America/Chicago", "US Central (Chicago)"],
  ["America/Denver", "US Mountain (Denver)"], ["America/Phoenix", "US Arizona (Phoenix)"],
  ["America/Los_Angeles", "US Pacific (Los Angeles)"], ["America/Anchorage", "Alaska (Anchorage)"],
  ["Pacific/Honolulu", "Hawaii (Honolulu)"], ["America/Toronto", "Canada Eastern (Toronto)"],
  ["America/Vancouver", "Canada Pacific (Vancouver)"], ["Europe/London", "UK (London)"],
  ["Europe/Dublin", "Ireland (Dublin)"], ["Australia/Sydney", "Australia (Sydney)"], ["Pacific/Auckland", "New Zealand (Auckland)"],
] as const;
const DAYS = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]] as const;

const localNow = (tz: string) => new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

export default async function Settings({ searchParams }: PageProps<"/director/settings">) {
  const director = await requireUser("director");
  const sp = await searchParams;
  const section: Section = SECTIONS.find((x) => x.key === sp.section)?.key ?? "general";
  const db = await getDb();
  const [c] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
  const days = new Set(c.schoolDays.split(","));
  const meta = SECTIONS.find((x) => x.key === section)!;

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Settings" sub={`${c.name} · ${ZONES.find(([z]) => z === c.timezone)?.[1] ?? c.timezone} · it is ${localNow(c.timezone)} at the center`} />
      <Saved show={sp.saved === "1"} text={`${meta.label} settings saved.`} />
      <Saved show={sp.saved === "reset"} text="Demo data reset. Everything is back to the start of today." />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[270px_1fr]">
        {/* section tabs */}
        <nav className="card grid gap-1 p-2" aria-label="Settings sections">
          {SECTIONS.map((x) => {
            const on = x.key === section;
            return (
              <Link key={x.key} href={`/director/settings?section=${x.key}`} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? "bg-primary-soft" : "hover:bg-surface-2/70"}`}>
                <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] text-base ${on ? "bg-primary shadow-[0_4px_10px_rgba(47,111,98,.3)]" : "bg-surface-2"}`}>
                  <span className={on ? "grayscale-0" : ""}>{x.icon}</span>
                </span>
                <span className="min-w-0">
                  <b className={`block text-sm ${on ? "text-primary" : ""}`}>{x.label}</b>
                  <span className="block truncate text-xs text-ink-3">{x.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0">
          {/* ---------------- GENERAL */}
          {section === "general" && (
            <Form section="general" title="Center details" sub="Shown on exports for licensing inspections and in parent emails.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Center name"><input name="name" required defaultValue={c.name} className={inputCls} /></Field>
                <Field label="State license number"><input name="licenseNo" defaultValue={c.licenseNo ?? ""} placeholder="e.g. DC-482119" className={inputCls} /></Field>
                <Field label="Address"><input name="address" defaultValue={c.address ?? ""} placeholder="Street, city, state, ZIP" className={inputCls} /></Field>
                <Field label="Phone"><input name="phone" defaultValue={c.phone ?? ""} placeholder="+1 555 0100" className={inputCls} /></Field>
                <Field label="Email for parents"><input name="email" type="email" defaultValue={c.email ?? ""} placeholder="hello@yourcenter.com" className={inputCls} /></Field>
                <Field label="Time zone" hint="All dates and times in Littlelog follow the center's time zone.">
                  <BrandField name="timezone" defaultValue={c.timezone} ariaLabel="Time zone"
                    options={ZONES.map(([z, label]) => ({ value: z, label: `${label} · now ${localNow(z)}` }))} />
                </Field>
              </div>
            </Form>
          )}

          {/* ---------------- HOURS */}
          {section === "hours" && (
            <Form section="hours" title="Opening hours" sub="When children can be checked in, and which days are school days.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Opens at"><input name="opensAt" type="time" required defaultValue={c.opensAt} className={inputCls} /></Field>
                <Field label="Closes at"><input name="closesAt" type="time" required defaultValue={c.closesAt} className={inputCls} /></Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">School days</legend>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(([v, l]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="checkbox" name="schoolDays" value={v} defaultChecked={days.has(v)} className="peer sr-only" />
                      <span className="grid h-12 w-16 place-items-center rounded-xl border border-line bg-surface text-sm font-bold text-ink-3 transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white">{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Note>Open {fmtTime(c.opensAt)} – {fmtTime(c.closesAt)}. Reports go out at {fmtTime(c.reportSendTime)}, before most pickups.</Note>
            </Form>
          )}

          {/* ---------------- REPORTS */}
          {section === "reports" && (
            <Form section="reports" title="Daily reports" sub="How and when each child's report reaches their parents."
              aside={<Preview title="Report greeting">
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="eyebrow">Today</div>
                  <div className="font-display mt-1 text-[19px] font-semibold leading-6">Hi! Emma had a great day today{c.reportEmojis ? " 😊" : ""}</div>
                  <div className="mt-2 text-sm text-ink-2">Lunch: ate all of it · Nap: 12:00 – 1:30</div>
                </div>
              </Preview>}>
              <Field label="Send time" hint="The AI drafts every report at this time. Teachers see a countdown.">
                <input name="reportSendTime" type="time" required defaultValue={c.reportSendTime} className={`${inputCls} max-w-[220px]`} />
              </Field>
              <Toggle name="teacherReview" checked={c.teacherReview} label="Teachers review before sending" hint="Recommended. Reports wait for “Approve & send”." />
              <Toggle name="reportEmojis" checked={c.reportEmojis} label="Friendly emojis in reports" hint="Adds a 😊 to the greeting. Incident reports never use emojis." />
              <Note>Reports only use what teachers logged. Other children are always written as “a friend”.</Note>
            </Form>
          )}

          {/* ---------------- NOTIFICATIONS */}
          {section === "notifications" && (
            <Form section="notifications" title="Parent notifications" sub="Channels used when a report is sent or an incident is approved."
              aside={<Preview title="What parents receive">
                <div className="grid gap-2">
                  {[["#2FA765", "WhatsApp", "Hi Sarah 👋 Today's report for Emma has been sent. Open the Littlelog app to check it.", c.notifyWhatsapp],
                    ["#4A7FD4", "Mail", "Emma's daily report is ready", c.notifyEmail],
                    ["#E8955A", "Littlelog", "Emma's report for today is ready 😊", c.notifyPush]].map(([color, app, text, on]) => (
                    <div key={String(app)} className={`flex gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 ${on ? "" : "opacity-40"}`}>
                      <span className="h-8 w-8 flex-none rounded-lg" style={{ background: String(color) }} />
                      <span className="min-w-0 text-[12.5px] leading-[17px]"><b className="block">{String(app)}{on ? "" : " · off"}</b><span className="text-ink-2">{String(text)}</span></span>
                    </div>
                  ))}
                </div>
              </Preview>}>
              <Toggle name="notifyWhatsapp" checked={c.notifyWhatsapp} label="WhatsApp" hint="Only for parents who opted in at enrollment. Uses pre-approved message templates." />
              <Toggle name="notifyEmail" checked={c.notifyEmail} label="Email" hint="Backup channel and permanent record." />
              <Toggle name="notifyPush" checked={c.notifyPush} label="App notifications" hint="For parents who installed the Littlelog app." />
              <Toggle name="notifySms" checked={c.notifySms} label="SMS text messages" hint="Optional. Carrier charges may apply." />
              <Note>Messages never include report or incident details, only that something is ready to read in the app.</Note>
            </Form>
          )}

          {/* ---------------- INCIDENTS */}
          {section === "incidents" && (
            <Form section="incidents" title="Incidents" sub="Every incident waits for the director before any parent hears about it.">
              <Locked label="Director approval required" hint="Always on. Parents only see approved incident reports." />
              <Locked label="Serious incident alert" hint="Head injuries, bleeding or allergic reactions show a red “Call parent now” banner." />
              <Field label="Remind me if an incident isn't approved within">
                <BrandField name="incidentReminderMin" defaultValue={String(c.incidentReminderMin)} ariaLabel="Incident reminder" className="max-w-[260px]"
                  options={[[0, "Don't remind me"], [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"]].map(([v, l]) => ({ value: String(v), label: String(l) }))} />
              </Field>
            </Form>
          )}

          {/* ---------------- PRIVACY */}
          {section === "privacy" && (
            <Form section="privacy" title="Privacy & data" sub="What is kept, for how long, and who can see it.">
              <Toggle name="deleteRecordings" checked={c.deleteRecordings} label="Delete voice recordings after transcription" hint="Only the text is kept. Recommended." />
              <Field label="Keep records for" hint="Daily logs, reports and incidents. Many states require at least 3 years.">
                <BrandField name="retentionYears" defaultValue={String(c.retentionYears)} ariaLabel="Keep records for" className="max-w-[260px]"
                  options={[3, 5, 7, 10].map((y) => ({ value: String(y), label: `${y} years` }))} />
              </Field>
              <Locked label="Photo consent off by default" hint="Turn it on per child, only with a signed form." />
              <Locked label="Parents only see their own children" hint="Enforced on every page and every message." />
              <Locked label="Audit log" hint="Every view, edit, approval and export is recorded." />
            </Form>
          )}

          {/* ---------------- DEMO */}
          {section === "demo" && (
            <section className="card p-6 md:p-7">
              <h2 className="font-display text-[22px] font-semibold">Demo data</h2>
              <p className="mt-1 text-sm text-ink-2">This is a portfolio demo. Everything uses sample families, and the sample day rebuilds itself every morning.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[["/teacher", "Teacher phone", "Record a voice note"], ["/parent", "Parent phone", "Receive the 4:30 report"], ["/demo", "Both phones", "Watch the full story"]].map(([h, t, d]) => (
                  <Link key={h} href={h} target="_blank" className="rounded-2xl border border-line p-4 hover:bg-surface-2/60">
                    <b className="block">{t} ↗</b><span className="text-sm text-ink-3">{d}</span>
                  </Link>
                ))}
              </div>
              <form action={resetDemoFromSettings}
                className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-danger/30 bg-danger-soft/50 p-4">
                <span className="min-w-0 flex-1 text-sm"><b className="block">Reset demo data</b><span className="text-ink-2">Removes every change and rebuilds today&apos;s sample day.</span></span>
                <button className="btn btn-sm btn-danger">↺ Reset now</button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Form({ section, title, sub, children, aside }: { section: string; title: string; sub: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={`grid items-start gap-6 ${aside ? "2xl:grid-cols-[1fr_360px]" : ""}`}>
      <form action={saveSettings} className="card grid gap-5 p-6 md:p-7">
        <input type="hidden" name="section" value={section} />
        <div>
          <h2 className="font-display text-[22px] font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-ink-2">{sub}</p>
        </div>
        {children}
        <div className="flex items-center justify-end border-t border-line pt-5">
          <button className="btn btn-primary">Save changes</button>
        </div>
      </form>
      {aside}
    </div>
  );
}

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="card sticky top-6 p-5">
      <div className="eyebrow mb-3">Preview · {title}</div>
      {children}
      <p className="mt-3 text-xs text-ink-3">Updates after you save.</p>
    </aside>
  );
}

function Locked({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3">
      <span className="min-w-0 flex-1"><b className="block text-[15px]">{label}</b><span className="text-[13px] text-ink-2">{hint}</span></span>
      <span className="badge bg-primary-soft text-primary">🔒 Always on</span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2/70 px-4 py-3 text-sm leading-6 text-ink-2">{children}</p>;
}
