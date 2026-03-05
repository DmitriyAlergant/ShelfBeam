import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "../db";
import { bookHistoryEntry, book } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// List history entries for a profile, joined with book data
router.get("/api/profiles/:profileId/history", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      entry: bookHistoryEntry,
      book: book,
    })
    .from(bookHistoryEntry)
    .leftJoin(book, eq(bookHistoryEntry.bookId, book.id))
    .where(eq(bookHistoryEntry.readerProfileId, String(req.params.profileId)))
    .orderBy(desc(bookHistoryEntry.createdAt));

  res.json(rows);
});

// Add book to history
router.post("/api/profiles/:profileId/history", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { book_id, source, source_id, status, comment, reactions } = req.body;
  if (!book_id || !source) {
    res.status(400).json({ error: "book_id and source are required" });
    return;
  }

  // Application-level dedup: one entry per book per reader
  const existing = await db
    .select()
    .from(bookHistoryEntry)
    .where(
      and(
        eq(bookHistoryEntry.readerProfileId, String(req.params.profileId)),
        eq(bookHistoryEntry.bookId, book_id),
      )
    );

  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  const inserted = await db
    .insert(bookHistoryEntry)
    .values({
      readerProfileId: String(req.params.profileId),
      bookId: book_id,
      source,
      sourceId: source_id || null,
      status: status || "reading",
      comment: comment || null,
      reactions: reactions || [],
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// Update history entry (reactions, status)
router.patch("/api/profiles/:profileId/history/:entryId", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { reactions, status, comment } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (reactions !== undefined) updates.reactions = reactions;
  if (status !== undefined) updates.status = status;
  if (comment !== undefined) updates.comment = comment;

  const updated = await db
    .update(bookHistoryEntry)
    .set(updates)
    .where(
      and(
        eq(bookHistoryEntry.id, String(req.params.entryId)),
        eq(bookHistoryEntry.readerProfileId, String(req.params.profileId)),
      )
    )
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "History entry not found" });
    return;
  }

  res.json(updated[0]);
});

// Delete history entry
router.delete("/api/profiles/:profileId/history/:entryId", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const deleted = await db
    .delete(bookHistoryEntry)
    .where(
      and(
        eq(bookHistoryEntry.id, String(req.params.entryId)),
        eq(bookHistoryEntry.readerProfileId, String(req.params.profileId)),
      )
    )
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "History entry not found" });
    return;
  }

  res.json({ deleted: true });
});

export default router;
