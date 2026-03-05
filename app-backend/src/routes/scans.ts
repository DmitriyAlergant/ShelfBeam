import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import { scan, readerProfile, bookHistoryEntry } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { uploadFile } from "../lib/s3";
import { resolveAppUser } from "../lib/resolve-user";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// Upload shelf image
router.post("/api/scans/upload", requireAuth(), upload.single("image"), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  const ext = path.extname(req.file.originalname) || ".jpg";
  const key = `${crypto.randomUUID()}${ext}`;
  await uploadFile(key, req.file.buffer, req.file.mimetype);

  const imageUrl = `/uploads/${key}`;
  res.json({ image_url: imageUrl });
});

// Create scan
router.post("/api/scans", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const { reader_profile_id, image_url, reader_comment } = req.body;
  if (!reader_profile_id || !image_url) {
    res.status(400).json({ error: "reader_profile_id and image_url are required" });
    return;
  }

  // Verify profile belongs to this user
  const profileRows = await db.select({ id: readerProfile.id }).from(readerProfile)
    .where(and(eq(readerProfile.id, reader_profile_id), eq(readerProfile.userId, user.id)));
  if (profileRows.length === 0) {
    res.status(404).json({ error: "Reader profile not found" });
    return;
  }

  const inserted = await db
    .insert(scan)
    .values({
      readerProfileId: reader_profile_id,
      imageUrl: image_url,
      readerComment: reader_comment || null,
      processingStatus: "detecting",
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// List scans for a reader profile
router.get("/api/scans", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const profileId = req.query.reader_profile_id as string;
  if (!profileId) {
    res.status(400).json({ error: "reader_profile_id query param is required" });
    return;
  }

  // Verify profile belongs to this user
  const profileRows = await db.select({ id: readerProfile.id }).from(readerProfile)
    .where(and(eq(readerProfile.id, profileId), eq(readerProfile.userId, user.id)));
  if (profileRows.length === 0) {
    res.status(404).json({ error: "Reader profile not found" });
    return;
  }

  const scans = await db
    .select()
    .from(scan)
    .where(eq(scan.readerProfileId, profileId))
    .orderBy(desc(scan.createdAt));

  res.json(scans);
});

// Get scan detail
router.get("/api/scans/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  // Ownership check: scan -> profile -> user
  const rows = await db
    .select({ scan: scan })
    .from(scan)
    .innerJoin(readerProfile, eq(scan.readerProfileId, readerProfile.id))
    .where(and(eq(scan.id, req.params.id as string), eq(readerProfile.userId, user.id)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(rows[0].scan);
});

// Update scan (status, detected_books, recommendation, reader_comment)
router.patch("/api/scans/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const isAdminBypass = (req as any).__adminBypass === true;

  // Ownership check for non-admin callers
  if (!isAdminBypass) {
    const owned = await db
      .select({ scanId: scan.id })
      .from(scan)
      .innerJoin(readerProfile, eq(scan.readerProfileId, readerProfile.id))
      .where(and(eq(scan.id, req.params.id as string), eq(readerProfile.userId, user.id)));

    if (owned.length === 0) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }
  }

  const { processing_status, processing_task_id, detected_books, recommendation, recommendation_summary, reader_comment } = req.body;

  // If caller provides a processing_task_id, validate it matches the current DB value.
  // This prevents stale worker writes from overwriting results of a newer task.
  if (processing_task_id !== undefined && processing_task_id !== null) {
    const current = await db.select({ processingTaskId: scan.processingTaskId })
      .from(scan)
      .where(eq(scan.id, req.params.id as string));
    if (current.length === 0) { res.status(404).json({ error: "Scan not found" }); return; }
    if (current[0].processingTaskId !== processing_task_id) {
      res.status(409).json({ error: "Task ID mismatch — scan was reprocessed" });
      return;
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (processing_status !== undefined) updates.processingStatus = processing_status;
  if (detected_books !== undefined) updates.detectedBooks = detected_books;
  if (recommendation !== undefined) updates.recommendation = recommendation;
  if (recommendation_summary !== undefined) updates.recommendationSummary = recommendation_summary;
  if (reader_comment !== undefined) updates.readerComment = reader_comment;
  if (processing_task_id !== undefined) updates.processingTaskId = processing_task_id;

  const updated = await db
    .update(scan)
    .set(updates)
    .where(eq(scan.id, req.params.id as string))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(updated[0]);
});

// Delete scan
router.delete("/api/scans/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  // Ownership check: scan -> profile -> user
  const rows = await db
    .select({ scan: scan })
    .from(scan)
    .innerJoin(readerProfile, eq(scan.readerProfileId, readerProfile.id))
    .where(and(eq(scan.id, req.params.id as string), eq(readerProfile.userId, user.id)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  await db.delete(bookHistoryEntry).where(
    and(eq(bookHistoryEntry.source, "scan"), eq(bookHistoryEntry.sourceId, req.params.id as string))
  );
  await db.delete(scan).where(eq(scan.id, req.params.id as string));

  res.json({ deleted: true });
});

export default router;
