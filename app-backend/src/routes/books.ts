import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../db";
import { book } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveAppUser } from "../lib/resolve-user";

const router = Router();

// Upsert book by ISBN or title+author normalization
router.post("/api/books", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const { title, author, isbn, cover_url, raw_metadata, is_series } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  // Try to find existing by ISBN first
  if (isbn) {
    const existing = await db
      .select()
      .from(book)
      .where(eq(book.isbn, isbn));

    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }
  }

  // Try to find by normalized title+author
  if (author) {
    const existing = await db
      .select()
      .from(book)
      .where(
        and(
          sql`lower(trim(${book.title})) = lower(trim(${title}))`,
          sql`lower(trim(${book.author})) = lower(trim(${author}))`,
        )
      );

    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }
  }

  const inserted = await db
    .insert(book)
    .values({
      title,
      author: author || null,
      isbn: isbn || null,
      coverUrl: cover_url || null,
      isSeries: is_series ?? null,
      rawMetadata: raw_metadata || null,
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// Get single book detail
router.get("/api/books/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const rows = await db
    .select()
    .from(book)
    .where(eq(book.id, req.params.id as string));

  if (rows.length === 0) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json(rows[0]);
});

export default router;
