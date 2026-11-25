# Littlelog: daily reports and check-in for daycares (demo)

Teachers speak or type a quick note about a child; Littlelog turns it into meal, nap, diaper and mood
entries and drafts a warm daily report the teacher sends with one tap. Parents get a WhatsApp, email and
app alert, check-in / pick-up messages, and a family chat with the teachers. Incidents go to the director
for approval first. The director sees attendance, reports, incidents and messages on one dashboard.

This is a **portfolio demo** with sample data (US daycare, Western names, America/New_York time).
WhatsApp, email and push notifications are simulated inside a phone simulator.

## Run locally

```bash
cd web
npm install
npm run dev -- --port 3150      # development (slower, live reload)
npm run demo                    # production build on port 3150 (fast, what Vercel runs)
```

Open <http://localhost:3150>. No database setup is needed: locally the app uses **PGlite**
(Postgres running inside Node), stored in `../.data/`. Tables and demo data are created on first start.
**Reset demo data** on the home page starts fresh.

## Demo accounts

| Role | How to open | Who |
|---|---|---|
| Director | `/login` → **Demo login** (or email `maria@sunnydays.demo`, password `demo1234`) | Maria Bennett |
| Teacher | `/teacher` (phone simulator, one tap) | Ms. Sara (Sunflower Room), Ms. Leah (2 rooms) |
| Parent | `/parent` (phone simulator, one tap) | Sarah Carter (Emma + Leo), Owen's and Maya's parents |

## What's inside

- **Teacher app** (phone): Today with report status, voice/typed notes → entries, unclear-name review,
  child profile (history, sent reports, parents, incidents), check in / check out with approved pickup people,
  family chat, "report sent" confirmation.
- **Parent app** (phone): today's report, history, incidents, check-in status, "not coming today", chat,
  notification banners + simulated WhatsApp and Mail apps.
- **Director app** (desktop): dashboard with date ranges, notification bell, daily report stages
  (Notes → Ready → Sent → Opened), incidents approval, attendance, messages, children (enrollment wizard,
  profiles), teachers & rooms, records export (PDF/CSV), audit log, settings.

## Deploy to Vercel + Neon

1. Import the repo in Vercel. **Root directory: `web`**. Framework: Next.js.
2. Add a Neon Postgres database (Vercel → Storage → Neon). It sets `DATABASE_URL`.
3. Environment variables:
   - `DATABASE_URL`: Neon connection string (when set, the app uses Neon instead of PGlite)
   - `CENTER_TZ` (optional): e.g. `America/New_York`
   - `DEMO_PASSWORD` (optional): director demo password, default `demo1234`
4. Deploy. Tables and demo data are created on the first request.

## Code map

- `src/db/`: Drizzle schema, table SQL, connection (PGlite locally / Neon in production), demo seed
- `src/lib/`: report writer, note parser, notifications, chat, attendance, alerts, audit text, time zone helpers
- `src/app/app/teacher`, `src/app/app/parent`, `src/app/app/phone`: the phone apps
- `src/app/director`: the director app · `src/app/login`: director sign-in
- `src/components/`: shared UI (brand dropdowns, calendar, chat, phone frame…)

## Privacy rules enforced in code

- Parents only ever see their own children; other children are written as "a friend".
- Incidents are drafts until the director approves them.
- Notifications never contain report details, only "ready" + where to read it.
- Views, edits, approvals, check-ins and sign-ins are written to the audit log.

## Before a real launch

- Real authentication for everyone (hashed passwords or a hosted provider, password reset, 2-step verification).
- Real WhatsApp (Twilio/Meta), email (e.g. Resend) and web push; scheduled reminders via a cron job.
- Speech-to-text and AI sorting with API keys (the demo uses a free, rule-based parser).
