import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? (() => { throw new Error("Missing required env DATABASE_URL"); })();

const pool = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(pool, { schema });
