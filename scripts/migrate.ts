import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("[Migration] Connecting to database...");
  
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    console.log("[Migration] Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[Migration] ✅ Migrations completed successfully!");
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

