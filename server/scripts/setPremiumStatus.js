// Simple Node.js script to set premium status (no tsx needed)
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function setPremiumStatus(email, isPremium) {
  try {
    console.log(`🔧 Setting premium status for ${email} to ${isPremium}...`);

    const result = await sql`
      UPDATE "users"
      SET "is_premium" = ${isPremium}, "updated_at" = NOW()
      WHERE "email" = ${email}
      RETURNING id, email, "is_premium"
    `;

    if (result.length === 0) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    const user = result[0];
    console.log(`✅ Premium status updated successfully!`);
    console.log(`   User: ${user.email}`);
    console.log(`   Premium: ${user.is_premium}`);
  } catch (error) {
    console.error("❌ Error updating premium status:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const premiumFlag = process.argv[3];

if (!email) {
  console.error("❌ Usage: node server/scripts/setPremiumStatus.js <email> <true|false>");
  console.error("   Example: node server/scripts/setPremiumStatus.js user@example.com true");
  process.exit(1);
}

const isPremium = premiumFlag === "true" || premiumFlag === "1" || premiumFlag === "yes";

setPremiumStatus(email, isPremium)
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
