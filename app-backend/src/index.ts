import express, { Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";
import { runMigrations } from "./db/migrate";
import healthRouter from "./routes/health";
import usersRouter from "./routes/users";
import profilesRouter from "./routes/profiles";

const PORT = process.env.PORT ?? (() => { throw new Error("Missing required env PORT"); })();
const _CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? (() => { throw new Error("Missing required env CLERK_SECRET_KEY"); })();
const _CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? (() => { throw new Error("Missing required env CLERK_PUBLISHABLE_KEY"); })();
const _DATABASE_URL = process.env.DATABASE_URL ?? (() => { throw new Error("Missing required env DATABASE_URL"); })();

async function main() {
  await runMigrations();

  const app = express();

  app.use(express.json());
  app.use(clerkMiddleware());

  app.use(healthRouter);
  app.use(usersRouter);
  app.use(profilesRouter);

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(Number(PORT), () => {
    console.log(`BookBeam backend listening on port ${PORT}`);
  });
}

main();
