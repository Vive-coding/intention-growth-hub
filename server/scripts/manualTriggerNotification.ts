import { GoalFollowUpService } from "../services/goalFollowUpService";
import "dotenv/config";

async function manualTrigger() {
  console.log("=== Manually Triggering Notification Service ===\n");
  
  try {
    console.log("Running scheduled check-ins...");
    await GoalFollowUpService.runScheduledCheckIns();
    console.log("✅ Check-ins completed successfully");
  } catch (error) {
    console.error("❌ Error running check-ins:", error);
    throw error;
  }
  
  process.exit(0);
}

manualTrigger().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

