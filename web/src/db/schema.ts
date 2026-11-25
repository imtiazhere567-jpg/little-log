import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// Dates are stored as "YYYY-MM-DD" and times as "HH:MM" in the center's local time.
// This keeps the demo free of timezone bugs: a nap at 12:00 is always 12:00.

export const centers = pgTable("centers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  reportSendTime: text("report_send_time").notNull().default("16:30"),
  deleteRecordings: boolean("delete_recordings").notNull().default(true),
  timezone: text("timezone").notNull().default("America/New_York"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  licenseNo: text("license_no"),
  opensAt: text("opens_at").notNull().default("07:30"),
  closesAt: text("closes_at").notNull().default("18:00"),
  schoolDays: text("school_days").notNull().default("1,2,3,4,5"),
  teacherReview: boolean("teacher_review").notNull().default(true),
  reportEmojis: boolean("report_emojis").notNull().default(true),
  notifyWhatsapp: boolean("notify_whatsapp").notNull().default(true),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(false),
  incidentReminderMin: integer("incident_reminder_min").notNull().default(30),
  retentionYears: integer("retention_years").notNull().default(5),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  centerId: integer("center_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["director", "teacher", "parent"] }).notNull(),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  centerId: integer("center_id").notNull(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull(),
  color: text("color").notNull(),
});

export const teacherRooms = pgTable(
  "teacher_rooms",
  {
    teacherId: integer("teacher_id").notNull(),
    roomId: integer("room_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.roomId] })],
);

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  photoConsent: boolean("photo_consent").notNull().default(false),
  avatarBg: text("avatar_bg").notNull(),
  avatarFg: text("avatar_fg").notNull(),
  medicalNotes: text("medical_notes"),
  enrolledOn: text("enrolled_on"),
  // usual schedule: drives the "Is Emma coming today?" and pickup reminders
  expectedIn: text("expected_in").notNull().default("08:00"),
  expectedOut: text("expected_out").notNull().default("17:00"),
});

/** Adults besides the parents who may pick the child up (grandparents, nanny…). Parents are always allowed. */
export const pickups = pgTable("pickups", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone"),
});

/** One row per child per day: check-in, check-out (and who picked up), or absent. Times are center-local "HH:MM". */
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  date: text("date").notNull(),
  checkInAt: text("check_in_at"),
  checkInBy: integer("check_in_by"),
  checkOutAt: text("check_out_at"),
  checkOutBy: integer("check_out_by"),
  pickedUpBy: text("picked_up_by"),
  absent: boolean("absent").notNull().default(false),
  absentReason: text("absent_reason"),
  absentBy: integer("absent_by"),
});

export const childParents = pgTable(
  "child_parents",
  {
    childId: integer("child_id").notNull(),
    parentId: integer("parent_id").notNull(),
    relationship: text("relationship"),
  },
  (t) => [primaryKey({ columns: [t.childId, t.parentId] })],
);

export const voiceNotes = pgTable("voice_notes", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  roomId: integer("room_id").notNull(),
  transcript: text("transcript").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
});

export type EntryType = "meal" | "nap" | "diaper" | "activity" | "mood" | "note";

export const logEntries = pgTable("log_entries", {
  id: serial("id").primaryKey(),
  // null while the AI could not tell which child was meant (needs review)
  childId: integer("child_id"),
  roomId: integer("room_id").notNull(),
  voiceNoteId: integer("voice_note_id"),
  type: text("type").$type<EntryType>().notNull(),
  label: text("label"),
  details: text("details").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  endTime: text("end_time"),
  needsReview: boolean("needs_review").notNull().default(false),
  mentionedName: text("mentioned_name"),
  candidateIds: text("candidate_ids"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  date: text("date").notNull(),
  // JSON: { greeting, lines: [{ type, label, text }], signoff }
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "sent"] }).notNull(),
  approvedBy: integer("approved_by"),
  sentAt: text("sent_at"),
});

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  voiceNoteId: integer("voice_note_id"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  injury: text("injury").notNull(),
  bodyPart: text("body_part").notNull(),
  actionTaken: text("action_taken").notNull(),
  staffId: integer("staff_id").notNull(),
  callParentNow: boolean("call_parent_now").notNull().default(false),
  isSerious: boolean("is_serious").notNull().default(false),
  status: text("status", { enum: ["draft", "approved", "rejected"] }).notNull(),
  approvedBy: integer("approved_by"),
  decidedAt: text("decided_at"),
  parentAckAt: text("parent_ack_at"),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull(),
  channel: text("channel", { enum: ["whatsapp", "email", "push"] }).notNull(),
  kind: text("kind", { enum: ["daily_report", "incident", "message", "attendance"] }).notNull(),
  recordId: integer("record_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  tableName: text("table_name").notNull(),
  recordId: integer("record_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Chat: one thread per child. In it: the child's parents, the room's teachers and the director.
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  senderId: integer("sender_id").notNull(),
  body: text("body").notNull(),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** How far each person has read in each thread (drives unread badges). */
export const messageReads = pgTable(
  "message_reads",
  {
    userId: integer("user_id").notNull(),
    childId: integer("child_id").notNull(),
    lastReadId: integer("last_read_id").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.childId] })],
);

/** The director's notification bell. */
export const staffAlerts = pgTable("staff_alerts", {
  id: serial("id").primaryKey(),
  centerId: integer("center_id").notNull(),
  kind: text("kind", { enum: ["report_sent", "incident", "message", "attendance"] }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});
