import { db } from "../db";
import { users } from "@shared/schema";

async function queryUsers() {
  try {
    console.log("🔍 Querying all users...\n");
    
    const allUsers = await db.select().from(users).orderBy(users.createdAt);
    
    console.log(`📊 Total Users: ${allUsers.length}\n`);
    
    if (allUsers.length === 0) {
      console.log("No users found in the database.");
      return;
    }
    
    console.log("👥 User Details:");
    console.log("=".repeat(80));
    
    allUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Name: ${user.firstName || 'N/A'} ${user.lastName || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Onboarding: ${user.onboardingCompleted ? '✅ Completed' : '⏳ Pending'}`);
      console.log(`   Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}`);
      console.log(`   Updated: ${user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}`);
      console.log(`   Timezone: ${user.timezone || 'Not set'}`);
      console.log("-".repeat(40));
    });
    
    console.log(`\n🎯 Summary:`);
    console.log(`   • Total Users: ${allUsers.length}`);
    console.log(`   • Completed Onboarding: ${allUsers.filter(u => u.onboardingCompleted).length}`);
    console.log(`   • Pending Onboarding: ${allUsers.filter(u => !u.onboardingCompleted).length}`);
    
  } catch (error) {
    console.error("❌ Error querying users:", error);
  } finally {
    process.exit(0);
  }
}

queryUsers();
