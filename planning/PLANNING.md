# Littlelog — Project Planning

**Daycare Daily Report System · Demo portfolio project**
Last updated: 24 Nov 2026

This document records every planning decision made so far: what the system is, who uses it, which platform each role gets, how many screens there are, and what comes next.

Related files:
- Original spec: `../Daycare Daily Report System – Build Spec.docx`
- Design system: `../design/DESIGN.md` and `../design/design-system.html`
- Screen designs: `../design/screen-teacher-today.html`

---

## Contents

1. [Project summary](#1-project-summary)
2. [Decisions made](#2-decisions-made)
3. [Tech stack](#3-tech-stack)
4. [Roles and permissions](#4-roles-and-permissions)
5. [Platform per role](#5-platform-per-role)
6. [Screens per role](#6-screens-per-role)
7. [Main user flows](#7-main-user-flows)
8. [Notifications and phone simulator](#8-notifications-and-phone-simulator)
9. [Privacy and safety rules](#9-privacy-and-safety-rules)
10. [Database tables](#10-database-tables)
11. [Demo data plan](#11-demo-data-plan)
12. [Work phases](#12-work-phases)
13. [Open questions](#13-open-questions)

---

## 1. Project summary

A web app for daycare centers (children aged 6 months to 5 years).

1. **Teachers** record short voice notes during the day ("Emma ate all her lunch, napped 12 to 1:30").
2. The app turns speech into text, and the **AI sorts it into entries per child**: meal, nap, diaper, activity, mood, note, incident.
3. At the end of the day the AI writes a **short, warm daily report** for each child. The teacher reviews it and sends it to the parents.
4. **Incidents** (falls, bites, injuries) become a formal incident report that the **director must approve** before the parent sees it.
5. The director can search all records and **export them as PDF/CSV** for licensing inspections.

**Project type:** demo for a portfolio. Everything runs on demo data so any visitor can try every role.

---

## 2. Decisions made

| # | Decision | Reason |
|---|---|---|
| 1 | **Demo portfolio project**, not production | Show the full product idea; production concerns later |
| 2 | **Neon Postgres on Vercel** instead of Supabase | Keep hosting and database together on Vercel |
| 3 | **Demo data pre-loaded** in the database | Every screen has realistic content from the first click |
| 4 | **One Next.js web app** for all three roles | One codebase, one deployment, visitors try it with one link |
| 5 | **Teacher and parent = mobile app shown in a phone simulator** | They use phones; the simulator shows it as a real app on a desktop screen, and on a real phone it runs full-screen |
| 6 | **Director = desktop app** | Desk work: tables, approvals, search, exports |
| 7 | **No native app store app for now** | Visitors can't easily install from a store; app store accounts cost money. Can wrap later with Capacitor or build an Expo app |
| 8 | **Design style: "Warm Morning"** (cream, sage, apricot; red only for incidents) | Approved 24 Nov 2026 |
| 9 | **Work order:** design → mood board → screen planning → implementation | Set by the project owner |
| 10 | **No published artifacts**; all design work is local files | Set by the project owner |
| 11 | **Parents are notified by WhatsApp, email and app notification** | WhatsApp is read fastest; email is the backup and record; the app holds the full report |
| 12 | **Notifications only say "report is ready" + link**; the report itself is only inside the app | Lock-screen and forwarded messages must not expose child details |
| 13 | **The phone simulator includes a WhatsApp-style app, an email app and our app** | Visitors see the full notification journey without any real messages being sent |

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js + Tailwind CSS** | Mobile-first for teacher/parent, desktop for director |
| Database | **Neon Postgres** (via Vercel) | Replaces Supabase from the original spec |
| Database access | Drizzle ORM or Prisma *(to decide)* | Typed queries and migrations |
| Login | Demo accounts with one-click role login | Real password login (hashed) can be added later |
| Speech-to-text | OpenAI Whisper API | Or simulated in demo mode (see open questions) |
| AI sorting and report writing | Claude API, returning structured JSON | Or simulated in demo mode |
| Email | Resend | "Report is ready" emails; simulated inside the phone in the demo |
| WhatsApp | WhatsApp Business Platform via Twilio | Pre-approved message templates; parent opt-in required. Simulated in the demo; Twilio sandbox for an optional real test |
| App notifications | Web push (PWA) | Works on iPhone only when the app is added to the home screen (iOS 16.4+). Simulated in the demo |
| SMS | Twilio | Optional, later |
| Hosting | **Vercel** | |

**Effect of not using Supabase:** Supabase had built-in login and row-level security. With Neon, the app's own code must:
- handle login and roles
- filter every parent query to **only that parent's children**

---

## 4. Roles and permissions

There are **3 roles**.

| Role | Who | Can do | Cannot do |
|---|---|---|---|
| **Director** (admin) | Center manager | Add/edit children, parents, teachers, rooms · approve, edit or reject incidents · view all records · export PDF/CSV · change settings | — |
| **Teacher** | Classroom staff | Record voice notes · see and edit today's entries for children **in their rooms** · review and send daily reports · see incident status | Approve incidents · see children in other rooms · manage users |
| **Parent** | Mother / father / guardian | See daily reports and **approved** incidents for **their own children only** · view past reports · acknowledge incidents | See any other child · see draft incidents |

Relationships:
- One child can have **2 parents**; one parent can have **several children**.
- One teacher can be assigned to **one or more rooms**.

---

## 5. Platform per role

| Role | Platform | How it is shown in the demo | Layout |
|---|---|---|---|
| **Teacher** | Mobile app (web, installable PWA) | Inside a **phone simulator** frame on desktop; full-screen on a real phone | Bottom tab bar, big "Hold to record" button |
| **Parent** | Mobile app (web, installable PWA) | Inside a **phone simulator** frame; opens straight from the email/SMS link | Bottom tab bar, report-first home |
| **Director** | **Desktop app** (web) | Full browser window | Left sidebar, tables, side panels; urgent actions also work on a phone |

**Why a web app instead of a native app:**
- Portfolio visitors can try it instantly; nobody has to install anything.
- Voice recording works in mobile browsers (iPhone Safari and Android Chrome).
- Parents receive reports by email/SMS links anyway.
- One codebase and one deployment.

**Trade-off:** push notifications on iPhone only work if the app is added to the home screen (iOS 16.4+). Email and SMS cover this for the demo.

---

## 6. Screens per role

### Total: 34 screens

| App | Screens |
|---|---|
| Shared demo + phone simulator | 5 |
| Teacher | 10 |
| Parent | 7 |
| Director | 12 |
| **Total** | **34** |

Legend: ⭐ = key screen (design first) · ✅ = designed

### 6.1 Shared demo + phone simulator screens: 5

| # | Screen | Purpose |
|---|---|---|
| S1 | ⭐ **Demo launcher** | First page of the portfolio demo. Three cards: Teacher app, Parent app, Director app |
| S2 | **Demo control panel** | Floating panel: "Play sample voice note", "Jump to 4:30 PM (send reports)", "Reset demo data" |
| S3 | ⭐ **Phone home & lock screen** | The simulated phone's home screen with 3 app icons (Littlelog, WhatsApp-style chat, Mail) and notification banners sliding down from the top |
| S4 | **WhatsApp-style chat** | Chat with "Sunny Days Childcare": *"Today's report for Emma has been sent. Open the Littlelog app to check it."* + link that opens the parent app |
| S5 | **Email inbox & email** | Inbox with the "Emma's daily report is ready" email; opening it shows a short email with a "View report" button that opens the parent app |

Note: the chat app is WhatsApp-*style* (green chat look) but does not copy the official WhatsApp logo.

### 6.2 Teacher app (mobile, phone simulator): 10

| # | Screen | What it does |
|---|---|---|
| T1 | Login | One-tap demo login as "Ms. Sara" |
| T2 | ⭐ ✅ **Today** | Children in my room, report progress, needs-review items, incident status |
| T3 | ⭐ **Recording** | Hold-to-record (or tap to start/stop), waveform, timer, live transcript |
| T4 | ⭐ **AI results** | "Found 6 entries for 3 children." Confirm, fix unclear names, edit before saving |
| T5 | Child day view | One child's timeline for today; edit or delete any entry |
| T6 | Add / edit entry | Bottom sheet: type, details, time |
| T7 | Voice notes history | Today's recordings with their transcripts |
| T8 | Reports review | All draft reports; "Approve all & send" |
| T9 | Report preview / edit | One child's report exactly as the parent will see it |
| T10 | Me | Profile, switch room, log out |

Bottom tabs: **Today · Notes · (Record) · Reports · Me**

### 6.3 Parent app (mobile, phone simulator): 7

| # | Screen | What it does |
|---|---|---|
| P1 | Login | Demo login, or opened straight from the email link |
| P2 | ⭐ **Today's report** | Home: the warm daily report; child switcher if 2+ children |
| P3 | Past reports | Calendar view with a dot on each day that has a report |
| P4 | Report detail | Any past day's report |
| P5 | Incidents | List of **approved** incident reports only |
| P6 | Incident detail | Full formal report with "I've read this" acknowledgement |
| P7 | Child & settings | Child info, photo consent, **notification preferences** (WhatsApp opt-in, email, app notifications, SMS) |

Bottom tabs: **Today · History · Incidents · Settings**

### 6.4 Director app (desktop): 12

| # | Screen | What it does |
|---|---|---|
| D1 | Login | Demo login as Director |
| D2 | ⭐ **Dashboard** | Reports sent/pending, incidents waiting, serious-incident red alert, today's activity |
| D3 | Incidents queue | Tabs: Draft / Approved / Rejected |
| D4 | ⭐ **Incident review** | Edit fields, then "Approve & notify parent" or "Reject" |
| D5 | Children | Table of all children; search; filter by room |
| D6 | Child profile | Details, parents, photo consent; tabs for logs, reports, incidents |
| D7 | Parents | List; add/edit; link to children |
| D8 | Teachers & rooms | Staff list, room assignments, rooms |
| D9 | Daily reports | All reports for any day: sent / pending, read any report |
| D10 | ⭐ **Records & export** | Search by child and date range; export PDF / CSV |
| D11 | Audit log | Who viewed, edited or approved what, and when |
| D12 | Settings | Report send time, recording deletion, center info |

Add/edit forms for children, parents and teachers open as **side panels**, so they are not counted as separate screens.

Sidebar: **Dashboard · Incidents · Children · Parents · Teachers & rooms · Daily reports · Records & export · Audit log · Settings**

### 6.5 Key screens (design first)

These 8 screens tell the whole story in order:

1. S1 Demo launcher
2. T2 Teacher Today ✅
3. T3 Recording
4. T4 AI results
5. S3 Phone home with WhatsApp / email / app notifications
6. P2 Parent Today's report
7. D2 Director Dashboard
8. D4 Incident review

---

## 7. Main user flows

### Flow A: Voice note → daily report

1. Teacher holds the record button and speaks (T3).
2. Speech-to-text creates a transcript.
3. The AI receives the transcript + the list of children in that room and returns JSON entries per child.
4. Teacher sees the results (T4). Unclear or duplicate names are marked **needs review**; the teacher picks the right child.
5. Entries are saved under each child (T2, T5).
6. At the send time (e.g. 4:30 PM) the AI writes one report per child.
7. Teacher reviews (T8, T9) and taps **Approve & send**.
8. Parent gets 3 notifications: a **WhatsApp message**, an **email** and an **app notification**, all saying the report is ready (S3, S4, S5).
9. Parent taps any of them and the full report opens in the app (P2).

### Flow B: Incident → director approval → parent

1. A voice note mentions an injury ("Ali fell and scraped his knee").
2. The AI creates a **draft incident report**: child, date, time, location, what happened, injury, body part, action taken, staff present, whether to call the parent now.
3. The draft goes **only to the director** (D2, D3). The teacher sees "Awaiting approval" (T2).
4. **Serious incidents** (head injury, bleeding, allergic reaction) show a **red alert** on the director dashboard: "Call parent now".
5. Director edits, then approves or rejects (D4).
6. After approval, the parent gets WhatsApp, email and app notifications ("An incident report about Ali is ready for you to read", with no details) and reads it in the app (P5, P6). It is saved in the records.

### Flow C: Licensing export

1. Director opens Records & export (D10).
2. Picks a child and a date range (e.g. one month).
3. Exports PDF or CSV.

---

## 8. Notifications and phone simulator

### 8.1 Channels

When a daily report is sent, or an incident is approved, the parent is notified on every channel they have turned on:

| Channel | Default | Notes |
|---|---|---|
| **WhatsApp** | On (after opt-in) | Fastest to be read. Uses a Meta-approved template |
| **Email** | On | Backup and permanent record |
| **App notification** | On (if the app is installed) | Banner from the Littlelog app |
| SMS | Off | Optional, later |

Each parent can change these in P7. Choosing per parent covers both WhatsApp-heavy countries (Pakistan, Middle East, UK, Europe, India) and the US, where SMS and email are more common.

### 8.2 Message wording

Notifications **never contain the report itself**. They only say it is ready and point to the app.

| Event | WhatsApp | Email subject | App notification |
|---|---|---|---|
| Daily report sent | *"Hi Sarah 👋 Today's report for Emma has been sent. Open the Littlelog app to check it: {link}"* | "Emma's daily report is ready" | "Emma's report for today is ready 😊" |
| Incident approved | *"Hi Sarah, an incident report about Ali is ready for you to read in the Littlelog app: {link}"* | "Incident report for Ali" | "New incident report for Ali" |

No emojis or soft language in incident messages beyond the greeting. The link opens the app at that report, after login.

### 8.3 The phone simulator in the demo

The parent's phone in the demo is a full simulated phone, not just our app:

```
┌──────────────────────────┐
│  9:41                    │
│ ┌──────────────────────┐ │  ← notification banners slide down here
│ │ 💬 Sunny Days · now   │ │     (WhatsApp-style, Mail, Littlelog)
│ │ Today's report for... │ │
│ └──────────────────────┘ │
│                          │
│   [Littlelog] [Chat] [Mail]  ← home screen app icons
│                          │
└──────────────────────────┘
```

**What the visitor sees:**

1. Teacher taps **Approve & send** (or the visitor clicks **"Jump to 4:30 PM"** in the demo control panel).
2. On the parent phone, **3 notification banners** slide down one after another: WhatsApp-style chat, Mail, Littlelog.
3. App icons show unread badges.
4. Tapping the **WhatsApp-style** banner opens the chat (S4) with the message from "Sunny Days Childcare". The link inside opens the Littlelog app.
5. Tapping the **Mail** banner opens the inbox/email (S5). The "View report" button opens the Littlelog app.
6. Tapping the **Littlelog** banner opens the report directly (P2).

All of this is simulated: no real WhatsApp messages or emails are sent, so it is free and works for every visitor.

**Optional live test:** a "Send me a real WhatsApp" button using the Twilio WhatsApp sandbox, for showing the real thing in interviews.

### 8.4 Requirements for real WhatsApp (later, production)

- WhatsApp Business Platform account (Meta Cloud API, or Twilio)
- Verified Meta business
- Message templates approved by Meta (category: utility)
- Parent opt-in recorded in the database
- Small cost per message, depending on country

---

## 9. Privacy and safety rules

These must hold everywhere:

| # | Rule |
|---|---|
| 1 | A parent only ever sees data for **their own children**. Every parent query is filtered by the parent's child list. |
| 2 | Other children are **never named** in a parent's report. "Ali and Emma played together" becomes "played with a friend". |
| 3 | **No incident reaches a parent without director approval.** |
| 4 | **No photos** unless photo consent is on. Default = off. Avatars show initials. |
| 5 | The AI **must not invent details**. Anything not in the teacher's notes is left out. |
| 6 | The AI only uses children from the given room list; unclear names become `needs_review`. It never guesses. |
| 7 | Login required for all roles. Passwords hashed. HTTPS. |
| 8 | **Audit log** of who viewed, edited or approved each record. |
| 9 | Original voice recordings can be deleted after transcription (director setting). |
| 10 | **Notifications (WhatsApp, email, app) never contain report or incident details**: only "ready" + a link. Details stay behind login. |
| 11 | WhatsApp is only sent to parents who have **opted in**. |

---

## 10. Database tables

From the spec, with small additions marked *(new)*.

| Table | Columns |
|---|---|
| `centers` | id, name |
| `users` | id, name, email, password_hash, role (director / teacher / parent), center_id |
| `rooms` | id, name, center_id |
| `teacher_rooms` *(new)* | teacher_id, room_id |
| `children` | id, name, date_of_birth, room_id, photo_consent (default false) |
| `child_parents` | child_id, parent_user_id |
| `voice_notes` | id, teacher_id, room_id, audio_url, transcript, created_at |
| `log_entries` | id, child_id, voice_note_id, type (meal / nap / diaper / activity / mood / note), details, time, start_time, end_time, needs_review, created_by |
| `daily_reports` | id, child_id, date, text, status (draft / sent), approved_by, sent_at |
| `incidents` | id, child_id, time, location, description, injury, body_part, action_taken, staff_id, call_parent_now, is_serious, status (draft / approved / rejected), approved_by, parent_acknowledged_at |
| `audit_log` | id, user_id, action, table_name, record_id, timestamp |
| `settings` *(new)* | center_id, report_send_time, delete_recordings_after_transcription |
| `notification_prefs` *(new)* | parent_user_id, whatsapp_number, whatsapp_opt_in, email_on, push_on, sms_on |
| `notifications` *(new)* | id, parent_user_id, channel (whatsapp / email / push / sms), type (daily_report / incident), record_id, message, sent_at, read_at |

---

## 11. Demo data plan

The database is pre-loaded so every screen looks alive.

| Item | Amount |
|---|---|
| Center | 1 ("Sunny Days Childcare") |
| Rooms | 4 (Sunflower, Bluebird, Ladybug, Rainbow) |
| Director | 1 |
| Teachers | 5 (one teaches in 2 rooms) |
| Children | ~32 (about 8 per room) |
| Parents | ~45 (some children have 2 parents; at least one parent has 2 children) |
| Days of history | 30 days of log entries and sent reports |
| Incidents | ~8: approved, rejected, 2 drafts today, 1 **serious** draft |
| Name traps | 2 children with similar names (e.g. Samuel / Samira) to show **needs review** |
| Sample voice notes | 3–5 pre-recorded audio clips + transcripts for the "Play sample voice note" button |
| Notification history | Past WhatsApp chat messages and emails for the demo parent, so the chat and inbox are not empty |

**Demo accounts (one-click login):**
- Director: "Director Maria"
- Teacher: "Ms. Sara" (Sunflower Room)
- Parent: "Emma's mom" (has 2 children, to show the child switcher)

---

## 12. Work phases

| Phase | Work | Status |
|---|---|---|
| 1 | Understand the spec | ✅ Done |
| 2 | Choose stack (Vercel + Neon, demo project) | ✅ Done |
| 3 | Design system ("Warm Morning") | ✅ Done |
| 4 | First screen design (Teacher Today) | ✅ Done |
| 5 | Platform per role + screen list | ✅ Done (this document) |
| 5b | Notifications plan (WhatsApp, email, app) + phone simulator | ✅ Done |
| 6 | Mood board (`design/moodboard.html`) | ✅ Done |
| 7 | Design the remaining key screens | Skipped: designed directly in code from the design system |
| 8 | **Implementation milestone 1** (`web/`, runs at http://localhost:3150) | ✅ Done 24 Nov 2026 |
| 9 | Implementation milestone 2 (see "Not built yet" in `web/README.md`) | ⏭ Next |

### Milestone 1: what is built

- Next.js 16 app in `web/`. Locally it uses PGlite (Postgres in Node, no install); on Vercel it switches to Neon via `DATABASE_URL`.
- Demo data: 1 center, 4 rooms, 5 teachers, 32 children, ~50 parents, 10 days of history, 6 incidents.
- S1 launcher, phone simulator (teacher + parent side by side), one-click demo login per role.
- Teacher: T2 Today, T3 Recording, T4 AI results, T5 child day (add/delete entries), T7 notes, T8 reports review, T9 report preview, T10 Me.
- Parent: P2 Today's report (child switcher), P3 history calendar, P4 report detail, P5/P6 incidents with "I've read this", P7 settings. WhatsApp / email / app notification banners slide in.
- Director: D2 dashboard with serious-incident red alert, D3 incidents queue, D4 incident review (edit, approve, reject), D5 children, D11 audit log.
- Tested end to end: record → save → send → parent notified → director approves. Privacy checks passed.
- Added the same day: all remaining director screens. D6 child profile, D7 parents, D8 teachers & rooms, D9 daily reports, D10 records search with real PDF and CSV export, D12 settings, plus add/edit side panels for children, parents and teachers. Tested in the browser.
- 25 Nov 2026: detailed director dashboard. Date-range and room filters, global search, 8 clickable stat tiles, "reports sent per school day" and "what teachers logged" charts, rooms today, needs-attention list, parent messages by channel, recent activity. Every item opens a popup with filter chips and pagination. Log-type colors re-tuned to pass the colorblind-safety check (meal #C9711C, diaper #0E9C9E).
- 25 Nov 2026: one enrollment flow (`/director/enroll`) replaces separate "add child" and "add parent". 3 steps: Child (room suggested from age, allergies & medical notes) → Parents (1–2, new or existing account, relationship, WhatsApp opt-in) → Consent & review. New fields: child_parents.relationship, users.whatsapp_opt_in, children.medical_notes. Sidebar redesigned with icons, grouped sections, live counts and a "New enrollment" button.
- 25 Nov 2026: removed the separate Parents screen (D7). Parents are added through enrollment and edited from the child's profile (name, relationship, email, phone, WhatsApp), which also shows "Also parent of …" for siblings. Searching a parent opens their child's profile with the edit panel. /director/parents now redirects to Children.
- 25 Nov 2026: child profile now has 5 tabs. Overview (enrolled on, age, room, teachers, consent, medical, quick stats) · Family (one card per parent: contact, parent since, last active, other children, engagement about this child, recent messages, call/email/edit/view app) · Today's log · Daily reports (paged) · Incidents. New fields: children.enrolled_on, users.created_at.
- 25 Nov 2026: built for daycares abroad (US/UK). Demo names changed to Western names (Owen Hayes, Samantha Price, Henry Walker, Ms. Claire…). All dates/times follow the CENTER's time zone (Settings → General, default US Eastern), not the server's. Settings rebuilt with 7 tabs: General (address, phone, email, license #, time zone) · Hours (open/close, school days) · Daily reports (send time, teacher review, emojis) · Notifications (WhatsApp/email/app/SMS, respected when sending) · Incidents (reminder) · Privacy & data (recordings, retention) · Demo (reset). Pagination on Incidents, Daily reports (now a filterable table + room cards), Children, Teachers & rooms, Audit log (+ role/action filters).
- 25 Nov 2026: phone simulator screens S3–S5 built. The parent phone opens on a home screen (Littlelog widget, Littlelog / WhatsApp / Mail icons with live unread badges, decorative apps and dock). WhatsApp: chat list → chat with Sunny Days (date separators, "Open in Littlelog" in every message). Mail: inbox → email with "View report". Notifications slide in, hide after ~7s, and tapping opens the matching app. Each app keeps its own read state. Tapping the phone's home bar returns to the home screen.

### Build order (from the spec, adjusted)

1. Project setup, Neon database, tables, **demo data seed**
2. Demo launcher + one-click role login + phone simulator frame
3. Director: children / parents / teachers / rooms management
4. Teacher: voice recording + speech-to-text
5. AI sorting into per-child entries + teacher edit screens
6. Daily report generation + teacher approve & send (email)
7. Incident drafts + director approval flow + serious alert
8. Parent app
9. Phone simulator: home screen, notification banners, WhatsApp-style chat, email inbox
10. Records search + PDF/CSV export
11. Audit log, photo consent, demo control panel, optional real WhatsApp (Twilio sandbox), SMS, polish

### "Done" checklist (from the spec)

- [ ] A teacher records a voice note mentioning 3 children and sees the correct entries under each child.
- [ ] Each parent receives a report only about their own child.
- [ ] An incident never reaches a parent until the director approves it.
- [ ] The director can export a month of records for one child as PDF.

---

## 13. Open questions

| # | Question | Options |
|---|---|---|
| 1 | Real AI or simulated in the demo? | **Real** (needs OpenAI + Claude API keys, small cost per use) · **Simulated** (pre-written transcripts, free) · **Both** (real when a key exists, simulated otherwise) |
| 2 | ~~Send real emails/WhatsApp in the demo?~~ | **Decided:** simulated inside the phone; optional real WhatsApp test via Twilio sandbox |
| 3 | Database library | Drizzle ORM or Prisma |
| 4 | Final product name | "Littlelog" is a working name |
| 5 | SMS | Include Twilio in the demo, or leave for later |

## Round: chat, director bell, report stages, send confirmation

- **Family chat (all three roles).** One thread per child. In it: the child's parents, the room's teachers, the director.
  Every message carries a role tag (Parent / Teacher / Director). Reply-with-quote, quick replies, live updates (3 s poll).
  - Parent: new **Chat** tab (5 tabs). Staff messages send an app notification ("New message from Ms. Sara about Emma"), never the text.
  - Teacher: **Chat** replaces the Me tab (Me is still on the avatar). Search + Unread filter. "Message parents" on the child's About tab.
  - Director: **Messages** page (list + open chat), can read every chat and write as Director.
- **Director bell** (sidebar): reports sent (one alert per send, not per child), incidents to approve, parent messages,
  and a live "N reports not sent yet" reminder from 1 hour before send time. New alerts also pop up as a toast.
- **Report stages** on Daily reports: Notes → Ready → Sent → Opened (who opened it and when). "Needs review" shows as a blocked Ready step.
- **Send confirmation** for teachers: "Emma's report is sent!" sheet listing who was notified and on which channels.
- **Voice notes stay internal** (by design): they become entries the teacher checks; parents are notified once, when the report is sent.
  The parent's Today now shows "N updates logged so far today" (count only, no details).
- Fixed: other children's names in saved voice notes were not being replaced with "a friend" (regex escape bug).

## Round: check-in / check-out, branded dropdowns, speed

- **Check-in / check-out (attendance).** Licensing requires arrival, departure and who picked up.
  - Enrollment: usual hours (drop-off / pick-up) + "who else may pick up" (grandparents, nanny…). Parents are always allowed.
  - Teacher: "N of 8 here now" bar on Today → Check in & out screen. Check out asks *who is picking up* (only people on the list). Mark absent with a reason. Undo for mistakes.
  - Parent: status card on Today (at daycare / went home / absent), "Not coming?" button. App messages: checked in, picked up + thank-you ("see you tomorrow! 👋").
  - Reminders: "Is Emma coming today?" 30 min after usual drop-off; pickup reminder 30 min before closing; director bell alert for a late pickup after closing. In the demo these run when the apps poll; production would use a cron job.
  - Director: Attendance page (date, room, here / picked up / not arrived / absent / late), "here now" chip on the dashboard, check-in panel on the child profile.
- **Room pop-up** on Teachers & rooms: here now, reports sent, incidents, teachers, every child's status today.
- **All dropdowns branded** (no native selects left): BrandSelect (URL filters), BrandPicker / BrandField (form values), DateField + BrandCalendar (dates), DateRangeSelect (dashboard custom range).
- **Speed:** preview runs in production mode (10–20× faster than dev); instant top loading bar; per-request caching; DB indexes.
