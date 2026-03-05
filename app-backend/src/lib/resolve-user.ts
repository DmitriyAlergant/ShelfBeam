import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db";
import { appUser } from "../db/schema";
import { eq } from "drizzle-orm";

type AppUser = typeof appUser.$inferSelect;

export async function resolveAppUser(req: Request, res: Response): Promise<AppUser | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const users = await db
    .select()
    .from(appUser)
    .where(eq(appUser.clerkId, userId));

  if (users.length === 0) {
    res.status(404).json({ error: "User not found. Call POST /api/users/sync first." });
    return null;
  }

  return users[0];
}
