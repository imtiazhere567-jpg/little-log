// Free, offline "AI-lite": turns what a teacher said about ONE child into draft entries.
// It looks for keywords and times. The teacher always checks the drafts before saving,
// and a real deployment can swap this for Claude without changing the screens.

export type EntryType = "meal" | "nap" | "diaper" | "activity" | "mood" | "note";
export type DraftEntry = { kind: "entry"; type: EntryType; label?: string; details: string; time: string; endTime?: string };
export type DraftIncident = {
  kind: "incident"; time: string; location: string; description: string; injury: string;
  bodyPart: string; actionTaken: string; serious: boolean; callParentNow: boolean;
};
export type Draft = DraftEntry | DraftIncident;

const pad = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "2:15" / "12" / "1:30 pm" → "14:15" using daycare hours (7–11 → AM, 12–6 → PM). */
export function clock(h: number, m = 0, ap?: string) {
  let hh = h;
  if (ap === "pm" && hh < 12) hh += 12;
  else if (ap === "am" && hh === 12) hh = 0;
  else if (!ap && hh >= 1 && hh <= 6) hh += 12;
  return `${pad(hh)}:${pad(m)}`;
}
const TIME = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/;
const norm = (ap?: string) => ap?.replace(/\./g, "") as "am" | "pm" | undefined;
function firstTime(s: string): string | null {
  const m = s.match(new RegExp(`(?:at|around|about|by)\\s+${TIME.source}`));
  return m ? clock(Number(m[1]), Number(m[2] ?? 0), norm(m[3])) : null;
}
function range(s: string): [string, string] | null {
  const m = s.match(new RegExp(`(?:from\\s+)?${TIME.source}\\s*(?:to|-|–|until|till)\\s*${TIME.source}`));
  if (!m) return null;
  const a = clock(Number(m[1]), Number(m[2] ?? 0), norm(m[3]) ?? norm(m[6]));
  const b = clock(Number(m[4]), Number(m[5] ?? 0), norm(m[6]));
  return [a, b];
}

const AMOUNTS: [RegExp, string][] = [
  [/\b(didn'?t eat|did not eat|refused|nothing|none of)\b/, "didn't eat"],
  [/\b(all|everything|finished|whole|every bite|cleaned (his|her|the) plate)\b/, "ate all of it"],
  [/\b(most)\b/, "ate most of it"],
  [/\b(half)\b/, "ate half"],
  [/\b(a little|little|a few bites|few bites|a bit|some)\b/, "ate a little"],
];
const MEAL_WORDS = /\b(ate|eat|eating|lunch|breakfast|snack|bottle|milk|drank|drink|food|fruit|meal|dinner|pasta|apple|banana|yogurt|crackers|sandwich|rice|soup|cereal)\b/;
const NAP_WORDS = /\b(nap|napped|slept|sleep|asleep|sleeping|rest|rested)\b/;
const DIAPER_WORDS = /\b(diaper|nappy|wet|dirty|poop|poo|pee|potty|toilet|bathroom|changed)\b/;
const HURT_WORDS = /\b(fell|fall|tripped|trip|bumped|bump|hit|bitten|(?:bit|bites?) (?:her|him|his|by|a friend|on)|scratch|scratched|scraped|scrape|cut|hurt|injur\w*|bleed\w*|blood|bloody|allerg\w*|swelling|swollen|pinched)\b/;
const MOOD_WORDS: [RegExp, string][] = [
  [/\bhappy\b/, "happy"], [/\bplayful\b/, "playful"], [/\bcalm\b/, "calm"], [/\bcheerful\b/, "cheerful"],
  [/\b(sad|crying|cried|teary)\b/, "a little sad"], [/\b(upset)\b/, "upset"], [/\b(tired|sleepy)\b/, "tired"],
  [/\b(cranky|fussy|grumpy)\b/, "cranky"], [/\b(excited)\b/, "excited"], [/\b(curious)\b/, "curious"], [/\bchatty\b/, "chatty"],
];
const ACTIVITY_WORDS = /\b(played|play|playing|painted|paint|painting|read|reading|story|built|building|blocks|sang|singing|music|danced|dancing|outside|sandbox|puzzle|drew|drawing|craft|colored|colouring|coloring|garden|slide|swing|tower|playdough|bubbles)\b/;
const PARTS = ["forehead", "head", "knee", "elbow", "arm", "hand", "finger", "leg", "foot", "toe", "lip", "mouth", "nose", "cheek", "eye", "ear", "back", "chin", "wrist", "shoulder"];
const PLACES: [RegExp, string][] = [
  [/\b(playground|slide|swing|climbing frame)\b/, "Playground"], [/\b(garden|yard|outside)\b/, "Garden"],
  [/\b(bathroom|toilet)\b/, "Bathroom"], [/\b(nap room|cot|crib)\b/, "Nap room"], [/\b(table|classroom|room|rug|block corner)\b/, "Classroom"],
];
const CARE = /\b(ice|ice pack|cold compress|cleaned|washed|bandage|band-aid|plaster|cream|comforted|cuddle|first aid|wiped)\b/;

/**
 * Parse a note about one child. `others` are the other children's first names in the room:
 * they are rewritten as "a friend" (parents never see other children's names).
 */
export function parseNote(text: string, opts: { firstName: string; others: string[]; now: string }): Draft[] {
  const own = new RegExp(`\\b${esc(opts.firstName)}('s)?\\b`, "gi");
  const friends = opts.others.length ? new RegExp(`\\b(${opts.others.map(esc).join("|")})\\b`, "gi") : null;
  const clean = (s: string) => {
    let t = s.replace(own, "").replace(/^\s*(she|he|they)\s+/i, "");
    if (friends) t = t.replace(friends, "a friend").replace(/a friend and a friend/gi, "friends");
    return cap(t.replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, ""));
  };
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|;\s*|\s+and then\s+|\s+then\s+/i).map((x) => x.trim()).filter(Boolean);
  const drafts: Draft[] = [];
  const used = new Set<number>();

  // no time said: use the previous entry's time (e.g. right after the nap), else "now" during
  // opening hours, else mid-afternoon (so a note typed at night doesn't say 5:51 AM)
  const dayNow = opts.now >= "07:00" && opts.now <= "18:30" ? opts.now : "15:00";
  sentences.forEach((raw, i) => {
    if (used.has(i)) return;
    const s = raw.toLowerCase();
    const prev = drafts.at(-1);
    const lastTime = prev ? (prev.kind === "entry" && prev.endTime ? prev.endTime : prev.time) : null;
    const at = firstTime(s) ?? lastTime;

    // 1. injuries → incident draft for the director
    if (HURT_WORDS.test(s) && !/\b(didn'?t|did not|no)\s+(fall|hurt|bite)/.test(s)) {
      const part = PARTS.find((p) => new RegExp(`\\b${p}`).test(s));
      const what = /scrap|scratch/.test(s) ? "Scraped" : /bump|hit/.test(s) ? "Bump on" : /\bbit(ten|e[sd]?)?\b/.test(s) ? "Bite mark on" : /cut|bleed|blood/.test(s) ? "Cut on" : /allerg|swell|swollen/.test(s) ? "Reaction on" : "Hurt";
      const careIdx = sentences.findIndex((x, j) => j >= i && CARE.test(x.toLowerCase()));
      if (careIdx > i) used.add(careIdx);
      const care = careIdx >= 0 ? sentences[careIdx] : "";
      const serious = /\b(head|forehead|bleed\w*|blood|allerg\w*|vomit\w*|unconscious|swollen|swelling)\b/.test(s);
      drafts.push({
        kind: "incident", time: at ?? dayNow,
        location: PLACES.find(([re]) => re.test(s))?.[1] ?? "Classroom",
        description: clean(raw), injury: part ? `${what} ${part}` : what === "Hurt" ? "Minor injury" : what.replace(" on", ""),
        bodyPart: part ? cap(part) : "Not stated",
        actionTaken: care ? clean(care) : "Comforted",
        serious, callParentNow: serious,
      });
      return;
    }
    // 2. nap
    if (NAP_WORDS.test(s)) {
      const r = range(s);
      drafts.push({ kind: "entry", type: "nap", details: "Nap", time: r?.[0] ?? firstTime(s) ?? dayNow, endTime: r?.[1] });
      return;
    }
    // 3. diaper / toilet
    if (DIAPER_WORDS.test(s) && !MEAL_WORDS.test(s)) {
      const wet = /\b(wet|pee)\b/.test(s), dirty = /\b(dirty|poop|poo)\b/.test(s);
      const details = /\b(potty|toilet|bathroom)\b/.test(s) ? "Used the toilet" : wet && dirty ? "Wet and dirty" : dirty ? "Dirty" : /\bdry\b/.test(s) ? "Dry" : "Wet";
      drafts.push({ kind: "entry", type: "diaper", details, time: at ?? dayNow });
      return;
    }
    // 4. meal
    if (MEAL_WORDS.test(s)) {
      const guess = at ?? dayNow;
      const label = /breakfast/.test(s) ? "Breakfast" : /lunch/.test(s) ? "Lunch" : /dinner/.test(s) ? "Dinner"
        : /bottle|milk/.test(s) ? "Bottle" : /snack/.test(s) ? (guess < "12:00" ? "Morning snack" : "Afternoon snack") : guess < "11:00" ? "Morning snack" : guess < "14:00" ? "Lunch" : "Afternoon snack";
      // no time said: use the meal's usual time
      const usual: Record<string, string> = { Breakfast: "08:30", "Morning snack": "09:30", Lunch: "12:00", "Afternoon snack": "15:00" };
      const time = firstTime(s) ?? usual[label] ?? at ?? dayNow;
      const amount = AMOUNTS.find(([re]) => re.test(s))?.[1] ?? "ate some";
      let food = s.match(/\b(?:had|ate|eat|eating|drank)\s+(?:only\s+)?([a-z][a-z ]{2,40}?)(?=\s+(?:and\s+(?:ate|drank|had|was|finished|didn'?t|did|then)|but|for|at|then|with\s+(?:a\s+friend|friends))\b|[,.]|$)/)?.[1] ?? "";
      // "all of her lunch", "a few bites of the pasta" → keep only the food
      food = food.replace(/^(?:all|most|half|some|a few bites|few bites|a bit|a little|none)\s+(?:of\s+)?/, "")
        .replace(/^(?:her|his|the|their|a|an|some)\s+/, "").trim();
      const skip = /^(all|most|half|it|lunch|snack|breakfast|dinner|bottle|everything|nothing|a little|little|some|bit|food|meal)$/;
      drafts.push({ kind: "entry", type: "meal", label, time, details: food && !skip.test(food) ? `${cap(food)}: ${amount}` : cap(amount) });
      return;
    }
    // 5. mood
    const moods = MOOD_WORDS.filter(([re]) => re.test(s)).map(([, w]) => w);
    if (moods.length && !ACTIVITY_WORDS.test(s)) {
      drafts.push({ kind: "entry", type: "mood", details: cap([...new Set(moods)].join(" and ")), time: at ?? dayNow });
      return;
    }
    // 6. activity
    if (ACTIVITY_WORDS.test(s)) {
      drafts.push({ kind: "entry", type: "activity", details: clean(raw).replace(/[.!?]$/, ""), time: at ?? dayNow });
      if (moods.length) drafts.push({ kind: "entry", type: "mood", details: cap([...new Set(moods)].join(" and ")), time: at ?? dayNow });
      return;
    }
    // 7. anything else is kept as a note
    const t = clean(raw).replace(/[.!?]$/, "");
    if (t.length > 2) drafts.push({ kind: "entry", type: "note", details: t, time: at ?? dayNow });
  });
  return drafts;
}
