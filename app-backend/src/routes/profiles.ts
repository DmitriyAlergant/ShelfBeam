import { Router, Request, Response } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "../db";
import { readerProfile, scan, bookHistoryEntry } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAppUser } from "../lib/resolve-user";

const router = Router();

router.get("/api/profiles", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const profiles = await db
    .select()
    .from(readerProfile)
    .where(eq(readerProfile.userId, user.id));

  res.json(profiles);
});

router.post("/api/profiles", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const { name, avatar_key, age, grade, gender, languages, interests } = req.body;

  const inserted = await db
    .insert(readerProfile)
    .values({
      userId: user.id,
      name,
      avatarKey: avatar_key,
      age,
      grade,
      gender,
      languages,
      interests,
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// Get single reader profile by ID
router.get("/api/profiles/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const rows = await db
    .select()
    .from(readerProfile)
    .where(and(eq(readerProfile.id, req.params.id as string), eq(readerProfile.userId, user.id)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(rows[0]);
});

// Update reader profile
router.patch("/api/profiles/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const { name, avatar_key, age, grade, gender, languages, interests, notes } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (avatar_key !== undefined) updates.avatarKey = avatar_key;
  if (age !== undefined) updates.age = age;
  if (grade !== undefined) updates.grade = grade;
  if (gender !== undefined) updates.gender = gender;
  if (languages !== undefined) updates.languages = languages;
  if (interests !== undefined) updates.interests = interests;
  if (notes !== undefined) updates.notes = notes;

  const updated = await db
    .update(readerProfile)
    .set(updates)
    .where(and(eq(readerProfile.id, req.params.id as string), eq(readerProfile.userId, user.id)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(updated[0]);
});

// Delete reader profile and all associated data
router.delete("/api/profiles/:id", requireAuth(), async (req: Request, res: Response) => {
  const user = await resolveAppUser(req, res);
  if (!user) return;

  const profileId = req.params.id as string;

  // Verify the profile belongs to this user
  const profiles = await db
    .select()
    .from(readerProfile)
    .where(and(eq(readerProfile.id, profileId), eq(readerProfile.userId, user.id)));

  if (profiles.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Delete associated data in a transaction
  await db.transaction(async (tx) => {
    await tx.delete(bookHistoryEntry).where(eq(bookHistoryEntry.readerProfileId, profileId));
    await tx.delete(scan).where(eq(scan.readerProfileId, profileId));
    await tx.delete(readerProfile).where(eq(readerProfile.id, profileId));
  });

  res.json({ deleted: true });
});

export default router;
