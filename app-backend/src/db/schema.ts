import { pgTable, uuid, text, smallint, boolean, timestamp, jsonb, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const appUser = pgTable("app_user", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkId: text("clerk_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const readerProfile = pgTable("reader_profile", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id"),
  name: text("name"),
  avatarKey: text("avatar_key"),
  birthYear: smallint("birth_year"),
  gender: text("gender"),
  languages: text("languages").array(),
  interests: text("interests").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const book = pgTable("book", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author: text("author"),
  isbn: text("isbn"),
  coverUrl: text("cover_url"),
  coverImg: bytea("cover_img"),
  isSeries: boolean("is_series"),
  rawMetadata: jsonb("raw_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const scan = pgTable("scan", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  readerProfileId: uuid("reader_profile_id"),
  imageUrl: text("image_url"),
  processingTaskId: uuid("processing_task_id"),
  processingTaskStarted: timestamp("processing_task_started", { withTimezone: true }),
  processingStatus: text("processing_status"),
  readerComment: text("reader_comment"),
  detectedBooks: jsonb("detected_books"),
  recommendation: jsonb("recommendation"),
  recommendationSummary: text("recommendation_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const bookHistoryEntry = pgTable("book_history_entry", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  readerProfileId: uuid("reader_profile_id"),
  bookId: uuid("book_id"),
  source: text("source"),
  sourceId: uuid("source_id"),
  comment: text("comment"),
  reactions: jsonb("reactions"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});
