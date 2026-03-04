import { Request, Response, NextFunction } from "express";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? (() => { throw new Error("Missing required env ADMIN_API_KEY"); })();

/**
 * Full Clerk auth bypass when X-Admin-Key matches ADMIN_API_KEY.
 * X-Admin-User-Id impersonates a specific Clerk user (required).
 * Runs BEFORE clerkMiddleware — sets __adminBypass flag so Clerk is skipped entirely,
 * and fakes req.auth so getAuth()/requireAuth() work downstream.
 */
export function adminAuthBypass(req: Request, _res: Response, next: NextFunction) {
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || adminKey !== ADMIN_API_KEY) {
    return next();
  }

  const userId = req.headers["x-admin-user-id"] as string | undefined;
  if (!userId) {
    _res.status(400).json({ error: "X-Admin-User-Id header required with X-Admin-Key" });
    return;
  }

  // Flag to skip clerkMiddleware entirely
  (req as any).__adminBypass = true;

  // Fake req.auth in the same shape Clerk uses — a function returning the auth object.
  // tokenType is required so getAuth()'s getAuthObjectForAcceptedToken doesn't strip userId.
  (req as any).auth = () => ({
    userId,
    sessionId: "admin_bypass",
    sessionClaims: {},
    tokenType: "session_token",
  });

  next();
}
