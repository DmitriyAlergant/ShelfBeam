import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import OpenAI from "openai";
import { db } from "../db";
import { bookHistoryEntry, book, readerProfile } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveAppUser } from "../lib/resolve-user";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? (() => { throw new Error("Missing required env OPENAI_API_KEY"); })();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? (() => { throw new Error("Missing required env OPENAI_BASE_URL"); })();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
  timeout: 30_000,
});

type HistoryContext = {
  history_entry_id: string;
  title: string;
  author: string | null;
  status: string;
  reactions: string[];
  comment: string | null;
};

function buildSystemPrompt(history: HistoryContext[]): string {
  const base = `You are a reading log parser for a kids' book app called BookBeam. A child (or their parent) will describe books they've been reading in freeform text. Your job is to extract structured book data from their input.

For each book mentioned, extract:
- title: The book title (best guess, capitalize properly). Do NOT append "(series)" to the title — use the is_series field instead.
- author: The author if mentioned or well-known to you based on the title, otherwise null
- is_series: true if the reader is referring to an entire book series rather than a single book, false otherwise
- inferred_status: One of "reading" (currently reading / started), "finished" (completed / done / read), or "abandoned" (stopped reading / gave up / didn't finish / abandoned)
- inferred_reactions: An array of emoji reactions that match the sentiment expressed. Pick from these emojis ONLY: 👍 👎 ❤️ 🔥 😂 😢 😱 🤔 🤯 💤 😡
  - If they loved it: ❤️ and/or 👍
  - If it was exciting/thrilling: 🔥 and/or 😱
  - If it was funny: 😂
  - If it was sad: 😢
  - If it was boring: 💤 and/or 👎
  - If it was confusing: 🤔
  - If it was mind-blowing: 🤯
  - If they hated it: 😡 and/or 👎
  - If no sentiment is expressed, use an empty array []
- comment: The reader's own words/opinion about the book, extracted verbatim or closely paraphrased from their input. This is distinct from reactions — it captures what they actually said. null if they didn't say anything specific about the book beyond just mentioning it.
- entry_type: "new" if this book is NOT in the reader's existing history, or "update" if it matches an existing history entry
- existing_history_entry_id: The history_entry_id from the existing history (for updates), or null (for new books)

Rules:
- Kids may misspell titles or use informal language — do your best to identify the correct book title
- If multiple books are mentioned, return all of them
- Default to "finished" status unless they explicitly say they're currently reading or just started
- Return ONLY a valid JSON array, no other text`;

  if (history.length > 0) {
    const historySection = `

## Reader's Existing History
The reader already has these books in their history:
${JSON.stringify(history)}

For each book the reader mentions:
- If it matches an existing history entry (by title — fuzzy match for misspellings), classify as entry_type: "update" and set existing_history_entry_id to the matching history_entry_id.
  For updates, only populate fields that have ACTUALLY CHANGED compared to the existing entry. Set unchanged fields to null.
  If nothing meaningful has changed about a book, DO NOT include it in the output at all.
- If it does NOT match any existing entry, classify as entry_type: "new" with existing_history_entry_id: null.`;
    return base + historySection;
  }

  return base + `\n\nThe reader has no existing history. Classify all entries as entry_type: "new" with existing_history_entry_id: null.`;
}

type ParsedBookEntry = {
  title: string;
  author: string | null;
  is_series: boolean;
  inferred_status: string | null;
  inferred_reactions: string[] | null;
  comment: string | null;
  entry_type: "new" | "update";
  existing_history_entry_id: string | null;
};

const router = Router();

router.post("/api/reading-log/parse", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const { text, profile_id } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text field is required" });
    return;
  }
  if (!profile_id || typeof profile_id !== "string") {
    res.status(400).json({ error: "profile_id field is required" });
    return;
  }

  // Verify profile belongs to this user
  const profileRows = await db.select({ id: readerProfile.id }).from(readerProfile)
    .where(and(eq(readerProfile.id, profile_id), eq(readerProfile.userId, user.id)));
  if (profileRows.length === 0) {
    res.status(404).json({ error: "Reader profile not found" });
    return;
  }

  // Fetch reader's existing history for LLM context
  const historyRows = await db
    .select({ entry: bookHistoryEntry, book: book })
    .from(bookHistoryEntry)
    .leftJoin(book, eq(bookHistoryEntry.bookId, book.id))
    .where(eq(bookHistoryEntry.readerProfileId, profile_id))
    .orderBy(desc(bookHistoryEntry.createdAt));

  const historyContext: HistoryContext[] = historyRows.map((row) => ({
    history_entry_id: row.entry.id,
    title: row.book?.title ?? "Unknown",
    author: row.book?.author ?? null,
    status: row.entry.status ?? "reading",
    reactions: (row.entry.reactions as string[]) ?? [],
    comment: row.entry.comment ?? null,
  }));

  const systemPrompt = buildSystemPrompt(historyContext);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text.trim() },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("LLM returned empty response for reading log parsing");
  }

  let parsed: ParsedBookEntry[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Retry once on malformed JSON
    const retry = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.trim() },
        { role: "assistant", content: raw },
        { role: "user", content: "Your response was not valid JSON. Please return ONLY a valid JSON array with no additional text." },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    });

    const retryRaw = retry.choices[0]?.message?.content?.trim();
    if (!retryRaw) {
      throw new Error("LLM returned empty response on retry for reading log parsing");
    }
    parsed = JSON.parse(retryRaw);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not an array");
  }

  res.json({ parsed, raw_input: text.trim() });
});

export default router;
