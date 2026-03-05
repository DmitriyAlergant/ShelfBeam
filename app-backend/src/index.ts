import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { runMigrations } from "./db/migrate";
import { adminAuthBypass } from "./middleware/admin-auth";
import { getFileStream } from "./lib/s3";
import landingRouter from "./routes/landing";
import healthRouter from "./routes/health";
import usersRouter from "./routes/users";
import profilesRouter from "./routes/profiles";
import scansRouter from "./routes/scans";
import booksRouter from "./routes/books";
import historyRouter from "./routes/history";
import readingLogRouter from "./routes/reading-log";

const PORT = process.env.PORT ?? (() => { throw new Error("Missing required env PORT"); })();
const _CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? (() => { throw new Error("Missing required env CLERK_SECRET_KEY"); })();
const _CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? (() => { throw new Error("Missing required env CLERK_PUBLISHABLE_KEY"); })();
const _DATABASE_URL = process.env.DATABASE_URL ?? (() => { throw new Error("Missing required env DATABASE_URL"); })();

async function main() {
  await runMigrations();

  const app = express();

  // Landing page — public, no auth
  app.use(landingRouter);

  app.use(cors());
  app.use(express.json());
  app.use(adminAuthBypass);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip Clerk middleware entirely for admin-authenticated requests
    if ((req as any).__adminBypass) return next();
    clerkMiddleware()(req, res, next);
  });

  // Proxy uploaded images from S3 (use regex to capture nested paths like crops/scan-id/file.jpg)
  app.get(/^\/uploads\/(.+)/, async (req: Request, res: Response) => {
    try {
      const key = req.params[0];
      const { stream, contentType } = await getFileStream(key);
      res.setHeader("Content-Type", contentType);
      stream.pipe(res);
    } catch (err: any) {
      if (err.Code === "NoSuchKey" || err.name === "NoSuchKey") {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      throw err;
    }
  });

  app.use(healthRouter);
  app.use(usersRouter);
  app.use(profilesRouter);
  app.use(scansRouter);
  app.use(booksRouter);
  app.use(historyRouter);
  app.use(readingLogRouter);

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.listen(Number(PORT), () => {
    console.log(`BookBeam backend listening on port ${PORT}`);
  });
}

main();
