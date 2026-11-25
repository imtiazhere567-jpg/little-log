import type { EntryType } from "@/db/schema";

// Demo mode: pre-written voice notes and the structured JSON the AI would return
// for them (spec section 8). Names are matched against the room's real children
// when saved; a name that matches 0 or 2+ children becomes "needs review".

export type SampleItem =
  | { child: string; type: EntryType; label?: string; details: string; time: string; endTime?: string }
  | {
      child: string; type: "incident"; time: string; location: string; description: string;
      injury: string; bodyPart: string; actionTaken: string; serious: boolean; callParentNow: boolean;
    };

export type Sample = { id: string; title: string; hint: string; transcript: string; items: SampleItem[] };

export const SAMPLES: Sample[] = [
  {
    id: "snack",
    title: "Afternoon snack & sandbox",
    hint: "4 children, 9 entries",
    transcript:
      "Afternoon snack was apple slices. Emma and Lily ate all of theirs, Henry only had a little. Ivy had a wet diaper at 2:50, she napped from 1 to 2:30. Lily and Henry played in the sandbox together and were really happy.",
    items: [
      { child: "Emma", type: "meal", label: "Afternoon snack", details: "Apple slices: ate all of it", time: "15:00" },
      { child: "Lily", type: "meal", label: "Afternoon snack", details: "Apple slices: ate all of it", time: "15:00" },
      { child: "Henry", type: "meal", label: "Afternoon snack", details: "Apple slices: ate a little", time: "15:00" },
      { child: "Ivy", type: "diaper", details: "Wet", time: "14:50" },
      { child: "Ivy", type: "nap", details: "Nap", time: "13:00", endTime: "14:30" },
      { child: "Lily", type: "activity", details: "Played in the sandbox with a friend", time: "15:15" },
      { child: "Henry", type: "activity", details: "Played in the sandbox with a friend", time: "15:15" },
      { child: "Lily", type: "mood", details: "Really happy", time: "15:15" },
      { child: "Henry", type: "mood", details: "Really happy", time: "15:15" },
    ],
  },
  {
    id: "fall",
    title: "A fall on the playground",
    hint: "Incident + unclear name",
    transcript:
      "Henry tripped on the playground at 3:10 and scraped his elbow. We washed it and put a bandage on, he stopped crying quickly. Sam drank all his milk at snack.",
    items: [
      {
        child: "Henry", type: "incident", time: "15:10", location: "Playground",
        description: "Tripped while running on the playground.", injury: "Scraped elbow", bodyPart: "Elbow",
        actionTaken: "Washed the scrape and put on a bandage. He stopped crying quickly.",
        serious: false, callParentNow: false,
      },
      { child: "Henry", type: "mood", details: "Upset after his fall, settled quickly", time: "15:15" },
      { child: "Sam", type: "meal", label: "Afternoon snack", details: "Milk: drank all of it", time: "15:00" },
    ],
  },
  {
    id: "story",
    title: "Story time & a diaper",
    hint: "3 children, 4 entries",
    transcript:
      "Samantha and Ivy did story time on the rug, they loved the bear book. Ivy was a bit tired before nap but woke up cheerful. Samuel had a dirty diaper at 3:20.",
    items: [
      { child: "Samantha", type: "activity", details: "Story time on the rug with a friend, loved the bear book", time: "11:00" },
      { child: "Ivy", type: "activity", details: "Story time on the rug with a friend, loved the bear book", time: "11:00" },
      { child: "Ivy", type: "mood", details: "A bit tired before nap, woke up cheerful", time: "14:35" },
      { child: "Samuel", type: "diaper", details: "Dirty", time: "15:20" },
    ],
  },
];
