import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? (() => { throw new Error("Missing required env DATABASE_URL"); })();

export async function runMigrations() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await pool.end();
}

// Allow running directly via `tsx src/db/migrate.ts`
if (require.main === module) {
  runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
