import postgres from "postgres";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = postgres(connectionString);

async function ensureModelSelectionSchema() {
  try {
    console.log("🔧 Ensuring model selection schema columns exist...");

    // Add columns to users table
    console.log("1. Adding columns to users table...");
    await sql`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "preferred_model" varchar(50),
        ADD COLUMN IF NOT EXISTS "is_premium" boolean DEFAULT false NOT NULL;
    `;
    console.log("   ✅ Users table updated");

    // Add column to chat_threads table
    console.log("2. Adding column to chat_threads table...");
    await sql`
      ALTER TABLE "chat_threads"
        ADD COLUMN IF NOT EXISTS "model" varchar(50);
    `;
    console.log("   ✅ Chat threads table updated");

    // Set existing threads to 'gpt-5-mini' for backward compatibility
    console.log("3. Setting default model for existing threads...");
    await sql`
      UPDATE "chat_threads"
      SET "model" = 'gpt-5-mini'
      WHERE "model" IS NULL;
    `;
    console.log("   ✅ Existing threads updated");

    console.log("✅ Model selection schema ensured successfully!");
  } catch (error) {
    console.error("❌ Error ensuring model selection schema:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

ensureModelSelectionSchema()
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
