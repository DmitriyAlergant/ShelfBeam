import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "../db";
import { appUser } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/api/users/sync", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if user already exists
  const existing = await db
    .select()
    .from(appUser)
    .where(eq(appUser.clerkId, userId));

  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  // Create new user
  const inserted = await db
    .insert(appUser)
    .values({ clerkId: userId })
    .returning();

  res.json(inserted[0]);
});

export default router;
