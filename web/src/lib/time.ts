// Center-local date/time helpers. Dates are "YYYY-MM-DD", times are "HH:MM" (24h).

// The DAYCARE's time zone (not the server's or the viewer's). Stored on the center and
// set at startup / from Settings. Kept on globalThis so every server module sees the same value.
const DEFAULT_TZ = process.env.CENTER_TZ || "America/New_York";
const tzHolder = globalThis as unknown as { __littlelogTz?: string };
export const centerTz = () => tzHolder.__littlelogTz ?? DEFAULT_TZ;
export function setCenterTz(tz: string | null | undefined) {
  if (!tz) return;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); tzHolder.__littlelogTz = tz; } catch { /* ignore unknown zones */ }
}

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: centerTz(),
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}

export const todayStr = () => parts(new Date()).date;
export const nowTime = () => parts(new Date()).time;

export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
}

export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** "12:00" style without AM/PM, for compact lists */
export function fmtShort(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}`;
}

export function fmtDate(date: string, opts: { weekday?: boolean; year?: boolean } = {}) {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: opts.weekday === false ? undefined : "long",
    month: "short",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
  });
}

export function minutesBetween(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export function durationLabel(start: string, end: string) {
  const mins = minutesBetween(start, end);
  if (mins <= 0) return "";
  const h = mins / 60;
  if (mins < 60) return `${mins} min`;
  const rounded = Math.round(h * 4) / 4;
  return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
}

export function ageLabel(dob: string, today: string) {
  const a = new Date(dob + "T12:00:00Z");
  const b = new Date(today + "T12:00:00Z");
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months--;
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

export function greetingFor(time: string) {
  const h = Number(time.split(":")[0]);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Center-local "YYYY-MM-DD" for a timestamp (e.g. a notification's createdAt). */
export const dateOf = (d: Date) => parts(d).date;

/** School days (Mon–Fri) from `from` to `to`, inclusive, oldest first. */
export function schoolDays(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (![0, 6].includes(weekday(d))) out.push(d);
  return out;
}

export function prevSchoolDay(date: string) {
  let d = addDays(date, -1);
  while ([0, 6].includes(weekday(d))) d = addDays(d, -1);
  return d;
}

/** "Nov 24, 4:31 PM" in the center's time zone. */
export function fmtStamp(d: Date | string | null | undefined, opts: { time?: boolean; date?: boolean } = {}) {
  if (!d) return "–";
  return new Date(d).toLocaleString("en-US", {
    timeZone: centerTz(),
    ...(opts.date === false ? {} : { month: "short", day: "numeric" }),
    ...(opts.time === false ? {} : { hour: "numeric", minute: "2-digit" }),
  });
}

/** The instant when the center's wall clock shows `date` `time` (e.g. "2026-11-24", "16:31"). */
export function zoned(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const p = parts(guess);
  const offset = Date.parse(`${p.date}T${p.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/** Center-local timestamp text "YYYY-MM-DDTHH:MM" for stored decision/ack times. */
export const nowStamp = () => `${todayStr()}T${nowTime()}`;

/** Added in the last 20 minutes → shows a "New" tag. */
export const isNew = (createdAt: Date | string | null | undefined, minutes = 20) =>
  !!createdAt && Date.now() - new Date(createdAt).getTime() < minutes * 60_000;
