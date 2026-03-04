import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "../db";
import { appUser, readerProfile } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/api/profiles", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db
    .select()
    .from(appUser)
    .where(eq(appUser.clerkId, userId));

  if (users.length === 0) {
    res.status(404).json({ error: "User not found. Call POST /api/users/sync first." });
    return;
  }

  const profiles = await db
    .select()
    .from(readerProfile)
    .where(eq(readerProfile.userId, users[0].id));

  res.json(profiles);
});

router.post("/api/profiles", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db
    .select()
    .from(appUser)
    .where(eq(appUser.clerkId, userId));

  if (users.length === 0) {
    res.status(404).json({ error: "User not found. Call POST /api/users/sync first." });
    return;
  }

  const { name, avatar_key, birth_year, gender, languages, interests } = req.body;

  const inserted = await db
    .insert(readerProfile)
    .values({
      userId: users[0].id,
      name,
      avatarKey: avatar_key,
      birthYear: birth_year,
      gender,
      languages,
      interests,
    })
    .returning();

  res.status(201).json(inserted[0]);
});

// Get single reader profile by ID
router.get("/api/profiles/:id", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select()
    .from(readerProfile)
    .where(eq(readerProfile.id, String(req.params.id)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(rows[0]);
});

// Update reader profile
router.patch("/api/profiles/:id", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, avatar_key, birth_year, gender, languages, interests, notes } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (avatar_key !== undefined) updates.avatarKey = avatar_key;
  if (birth_year !== undefined) updates.birthYear = birth_year;
  if (gender !== undefined) updates.gender = gender;
  if (languages !== undefined) updates.languages = languages;
  if (interests !== undefined) updates.interests = interests;
  if (notes !== undefined) updates.notes = notes;

  const updated = await db
    .update(readerProfile)
    .set(updates)
    .where(eq(readerProfile.id, String(req.params.id)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(updated[0]);
});

export default router;
