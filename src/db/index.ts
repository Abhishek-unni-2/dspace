import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and set it to your Neon (or local Postgres) connection string."
  );
}

// Neon URLs use the serverless HTTP driver; anything else (e.g. local
// Postgres) uses the standard node-postgres driver.
export const db = url.includes("neon.tech")
  ? drizzleNeon(neon(url), { schema })
  : (drizzlePg(url, { schema }) as unknown as ReturnType<typeof drizzleNeon<typeof schema>>);
