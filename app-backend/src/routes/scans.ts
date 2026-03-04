import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import { appUser, scan } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { uploadFile } from "../lib/s3";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

// Upload shelf image
router.post("/api/scans/upload", requireAuth(), upload.single("image"), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

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
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { reader_profile_id, image_url, reader_comment } = req.body;
  if (!reader_profile_id || !image_url) {
    res.status(400).json({ error: "reader_profile_id and image_url are required" });
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
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profileId = req.query.reader_profile_id as string;
  if (!profileId) {
    res.status(400).json({ error: "reader_profile_id query param is required" });
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
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(scan)
    .where(eq(scan.id, String(req.params.id)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(rows[0]);
});

// Update scan (status, detected_books, recommendation, reader_comment)
router.patch("/api/scans/:id", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { processing_status, detected_books, recommendation, recommendation_summary, reader_comment } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (processing_status !== undefined) updates.processingStatus = processing_status;
  if (detected_books !== undefined) updates.detectedBooks = detected_books;
  if (recommendation !== undefined) updates.recommendation = recommendation;
  if (recommendation_summary !== undefined) updates.recommendationSummary = recommendation_summary;
  if (reader_comment !== undefined) updates.readerComment = reader_comment;

  const updated = await db
    .update(scan)
    .set(updates)
    .where(eq(scan.id, String(req.params.id)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(updated[0]);
});

export default router;
