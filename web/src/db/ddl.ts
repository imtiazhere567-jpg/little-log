// Table creation SQL. Mirrors ./schema.ts. Runs once on first start.
export const DDL = [
  `CREATE TABLE IF NOT EXISTS centers (
    id serial PRIMARY KEY, name text NOT NULL,
    report_send_time text NOT NULL DEFAULT '16:30',
    delete_recordings boolean NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY, center_id integer NOT NULL, name text NOT NULL,
    email text NOT NULL, phone text, role text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id serial PRIMARY KEY, center_id integer NOT NULL, name text NOT NULL,
    age_group text NOT NULL, color text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS teacher_rooms (
    teacher_id integer NOT NULL, room_id integer NOT NULL,
    PRIMARY KEY (teacher_id, room_id))`,
  `CREATE TABLE IF NOT EXISTS children (
    id serial PRIMARY KEY, room_id integer NOT NULL, first_name text NOT NULL,
    last_name text NOT NULL, date_of_birth text NOT NULL,
    photo_consent boolean NOT NULL DEFAULT false,
    avatar_bg text NOT NULL, avatar_fg text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS child_parents (
    child_id integer NOT NULL, parent_id integer NOT NULL,
    PRIMARY KEY (child_id, parent_id))`,
  `CREATE TABLE IF NOT EXISTS voice_notes (
    id serial PRIMARY KEY, teacher_id integer NOT NULL, room_id integer NOT NULL,
    transcript text NOT NULL, date text NOT NULL, time text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS log_entries (
    id serial PRIMARY KEY, child_id integer, room_id integer NOT NULL,
    voice_note_id integer, type text NOT NULL, label text, details text NOT NULL,
    date text NOT NULL, time text NOT NULL, end_time text,
    needs_review boolean NOT NULL DEFAULT false, mentioned_name text,
    candidate_ids text, created_by integer NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS log_entries_child_date ON log_entries (child_id, date)`,
  `CREATE TABLE IF NOT EXISTS daily_reports (
    id serial PRIMARY KEY, child_id integer NOT NULL, date text NOT NULL,
    content text NOT NULL, status text NOT NULL, approved_by integer, sent_at text)`,
  `CREATE INDEX IF NOT EXISTS daily_reports_child_date ON daily_reports (child_id, date)`,
  `CREATE TABLE IF NOT EXISTS incidents (
    id serial PRIMARY KEY, child_id integer NOT NULL, voice_note_id integer,
    date text NOT NULL, time text NOT NULL, location text NOT NULL,
    description text NOT NULL, injury text NOT NULL, body_part text NOT NULL,
    action_taken text NOT NULL, staff_id integer NOT NULL,
    call_parent_now boolean NOT NULL DEFAULT false,
    is_serious boolean NOT NULL DEFAULT false, status text NOT NULL,
    approved_by integer, decided_at text, parent_ack_at text)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id serial PRIMARY KEY, parent_id integer NOT NULL, channel text NOT NULL,
    kind text NOT NULL, record_id integer NOT NULL, title text NOT NULL,
    body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz)`,
  // added for the enrollment flow (safe to run on an existing database)
  `ALTER TABLE child_parents ADD COLUMN IF NOT EXISTS relationship text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_notes text`,
  // when a family joined (child enrolled / parent account created)
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS enrolled_on text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
  // when an entry was ADDED (its "time" is when it happened) — drives the "New" tag
  `ALTER TABLE log_entries ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
  // center settings
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York'`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS address text`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS license_no text`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS opens_at text NOT NULL DEFAULT '07:30'`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS closes_at text NOT NULL DEFAULT '18:00'`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS school_days text NOT NULL DEFAULT '1,2,3,4,5'`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS teacher_review boolean NOT NULL DEFAULT true`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS report_emojis boolean NOT NULL DEFAULT true`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT false`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS incident_reminder_min integer NOT NULL DEFAULT 30`,
  `ALTER TABLE centers ADD COLUMN IF NOT EXISTS retention_years integer NOT NULL DEFAULT 5`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id serial PRIMARY KEY, user_id integer NOT NULL, action text NOT NULL,
    table_name text NOT NULL, record_id integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now())`,
  // chat + director bell
  `CREATE TABLE IF NOT EXISTS messages (
    id serial PRIMARY KEY, child_id integer NOT NULL, sender_id integer NOT NULL,
    body text NOT NULL, reply_to_id integer,
    created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS messages_child ON messages (child_id, id)`,
  `CREATE TABLE IF NOT EXISTS message_reads (
    user_id integer NOT NULL, child_id integer NOT NULL, last_read_id integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, child_id))`,
  `CREATE TABLE IF NOT EXISTS staff_alerts (
    id serial PRIMARY KEY, center_id integer NOT NULL, kind text NOT NULL,
    title text NOT NULL, body text NOT NULL, href text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz)`,
  // speed: the lookups every screen does
  `CREATE INDEX IF NOT EXISTS notifications_parent ON notifications (parent_id, read_at)`,
  `CREATE INDEX IF NOT EXISTS notifications_record ON notifications (kind, record_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_created ON notifications (created_at)`,
  `CREATE INDEX IF NOT EXISTS log_entries_room_date ON log_entries (room_id, date)`,
  `CREATE INDEX IF NOT EXISTS daily_reports_date ON daily_reports (date, status)`,
  `CREATE INDEX IF NOT EXISTS incidents_child ON incidents (child_id, date)`,
  `CREATE INDEX IF NOT EXISTS voice_notes_room_date ON voice_notes (room_id, date)`,
  `CREATE INDEX IF NOT EXISTS audit_log_created ON audit_log (created_at)`,
  `CREATE INDEX IF NOT EXISTS children_room ON children (room_id)`,
  // attendance (check-in / check-out)
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS expected_in text NOT NULL DEFAULT '08:00'`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS expected_out text NOT NULL DEFAULT '17:00'`,
  `CREATE TABLE IF NOT EXISTS pickups (
    id serial PRIMARY KEY, child_id integer NOT NULL, name text NOT NULL,
    relationship text NOT NULL, phone text)`,
  `CREATE TABLE IF NOT EXISTS attendance (
    id serial PRIMARY KEY, child_id integer NOT NULL, date text NOT NULL,
    check_in_at text, check_in_by integer, check_out_at text, check_out_by integer,
    picked_up_by text, absent boolean NOT NULL DEFAULT false, absent_reason text, absent_by integer)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS attendance_child_date ON attendance (child_id, date)`,
  `CREATE INDEX IF NOT EXISTS attendance_date ON attendance (date)`,
];

export const ALL_TABLES = [
  "centers", "users", "rooms", "teacher_rooms", "children", "child_parents",
  "voice_notes", "log_entries", "daily_reports", "incidents", "notifications", "audit_log",
  "messages", "message_reads", "staff_alerts", "pickups", "attendance",
];
