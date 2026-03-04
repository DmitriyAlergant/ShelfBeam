import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? (() => { throw new Error("Missing required env OPENAI_API_KEY"); })();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? (() => { throw new Error("Missing required env OPENAI_BASE_URL"); })();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
  timeout: 30_000,
});

const SYSTEM_PROMPT = `You are a reading log parser for a kids' book app called BookBeam. A child (or their parent) will describe books they've been reading in freeform text. Your job is to extract structured book data from their input.

For each book mentioned, extract:
- title: The book title (best guess, capitalize properly)
- author: The author if mentioned, otherwise null
- inferred_status: Either "reading" (currently reading / started) or "finished" (completed / done / read)
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

Rules:
- Kids may misspell titles or use informal language — do your best to identify the correct book title
- If multiple books are mentioned, return all of them
- Default to "finished" status unless they explicitly say they're currently reading or just started
- Keep author as null if not mentioned — do not guess the author
- Return ONLY a valid JSON array, no other text

Example input: "I just finished Harry Potter and it was so amazing! Also started reading Diary of a Wimpy Kid with my brother, it's pretty funny"
Example output: [{"title":"Harry Potter","author":null,"inferred_status":"finished","inferred_reactions":["❤️","👍"]},{"title":"Diary of a Wimpy Kid","author":null,"inferred_status":"reading","inferred_reactions":["😂"]}]`;

type ParsedBookEntry = {
  title: string;
  author: string | null;
  inferred_status: string;
  inferred_reactions: string[];
};

const router = Router();

router.post("/api/reading-log/parse", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text field is required" });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text.trim() },
    ],
    temperature: 0.3,
    max_tokens: 1024,
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.trim() },
        { role: "assistant", content: raw },
        { role: "user", content: "Your response was not valid JSON. Please return ONLY a valid JSON array with no additional text." },
      ],
      temperature: 0.1,
      max_tokens: 1024,
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
