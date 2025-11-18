/**
 * Script to run evaluations on conversations
 * 
 * Usage:
 *   npm run eval               # Evaluate all recent conversations
 *   npm run eval --count 50    # Evaluate 50 conversations
 *   npm run eval --thread abc  # Evaluate specific thread
 */

import { judgeAgent, ConversationToEvaluate } from "./judgeAgent";
import { db } from "../../db";
import { chatThreads, chatMessages } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface EvalOptions {
  count?: number;
  threadId?: string;
  outputFile?: string;
}

/**
 * Fetch conversations from database
 */
async function fetchConversations(options: EvalOptions): Promise<ConversationToEvaluate[]> {
  const conversations: ConversationToEvaluate[] = [];

  if (options.threadId) {
    // Fetch specific thread
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, options.threadId))
      .orderBy(chatMessages.createdAt);

    if (messages.length > 0) {
      conversations.push({
        id: options.threadId,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content || "",
        })),
      });
    }
  } else {
    // Fetch recent threads
    const limit = options.count || 100;
    const threads = await db
      .select()
      .from(chatThreads)
      .orderBy(desc(chatThreads.updatedAt))
      .limit(limit);

    for (const thread of threads) {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.threadId, thread.id))
        .orderBy(chatMessages.createdAt);

      if (messages.length >= 2) {
        // Only include conversations with at least 1 exchange
        conversations.push({
          id: thread.id,
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content || "",
          })),
        });
      }
    }
  }

  return conversations;
}

/**
 * Main evaluation function
 */
async function runEvaluations(options: EvalOptions = {}) {
  console.log("🔍 Fetching conversations...");
  const conversations = await fetchConversations(options);
  console.log(`✅ Found ${conversations.length} conversations to evaluate`);

  if (conversations.length === 0) {
    console.log("No conversations to evaluate");
    return;
  }

  console.log("\n🤖 Running evaluations...");
  const results = await judgeAgent.evaluateBatch(conversations, (completed, total) => {
    console.log(`Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
  });

  console.log(`\n✅ Evaluated ${results.length} conversations`);

  // Calculate statistics
  console.log("\n📊 Calculating statistics...");
  const stats = judgeAgent.calculateStatistics(results);

  // Display results
  console.log("\n" + "=".repeat(60));
  console.log("EVALUATION RESULTS");
  console.log("=".repeat(60));

  console.log("\n📈 Average Scores:");
  console.log(`  Overall: ${stats.averageScores.overall.toFixed(2)}/5.0`);
  console.log(`  Tool Usage: ${stats.averageScores.toolUsage.toFixed(2)}/5.0`);
  console.log(`  Response Quality: ${stats.averageScores.responseQuality.toFixed(2)}/5.0`);
  console.log(`  Goal Understanding: ${stats.averageScores.goalUnderstanding.toFixed(2)}/5.0`);
  console.log(`  Actionability: ${stats.averageScores.actionability.toFixed(2)}/5.0`);
  console.log(`  Framework Application: ${stats.averageScores.frameworkApplication.toFixed(2)}/5.0`);

  console.log("\n✅ Pass Rates:");
  console.log(`  Conversation Flow: ${(stats.passRates.flowQuality * 100).toFixed(1)}%`);
  console.log(`  User Engagement: ${(stats.passRates.userEngagement * 100).toFixed(1)}%`);
  console.log(`  Outcome Achievement: ${(stats.passRates.outcomeAchievement * 100).toFixed(1)}%`);

  console.log("\n🚨 Most Common Critical Issues:");
  const sortedCritical = Array.from(stats.mostCommonIssues.critical.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  sortedCritical.forEach(([issue, count]) => {
    console.log(`  ${count}x - ${issue}`);
  });

  console.log("\n⚠️  Most Common Quality Issues:");
  const sortedQuality = Array.from(stats.mostCommonIssues.quality.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  sortedQuality.forEach(([issue, count]) => {
    console.log(`  ${count}x - ${issue}`);
  });

  console.log("\n💡 Top Recommendations:");
  const sortedRecs = Array.from(stats.topRecommendations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  sortedRecs.forEach(([rec, count]) => {
    console.log(`  ${count}x - ${rec}`);
  });

  // Save detailed results to file
  const outputFile = options.outputFile || `eval-results-${Date.now()}.json`;
  const outputPath = path.join(process.cwd(), "server", "ai", "evaluation", "results", outputFile);

  // Ensure results directory exists
  const resultsDir = path.dirname(outputPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        metadata: {
          evaluatedAt: new Date().toISOString(),
          conversationCount: results.length,
          options,
        },
        statistics: {
          averageScores: stats.averageScores,
          passRates: stats.passRates,
          criticalIssues: Array.from(stats.mostCommonIssues.critical.entries()),
          qualityIssues: Array.from(stats.mostCommonIssues.quality.entries()),
          recommendations: Array.from(stats.topRecommendations.entries()),
        },
        detailedResults: results,
      },
      null,
      2
    )
  );

  console.log(`\n💾 Detailed results saved to: ${outputPath}`);
  console.log("\n" + "=".repeat(60));
}

// CLI argument parsing
const args = process.argv.slice(2);
const options: EvalOptions = {};

for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];

  switch (flag) {
    case "--count":
      options.count = parseInt(value);
      break;
    case "--thread":
      options.threadId = value;
      break;
    case "--output":
      options.outputFile = value;
      break;
  }
}

// Run if called directly
if (require.main === module) {
  runEvaluations(options)
    .then(() => {
      console.log("✅ Evaluation complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Evaluation failed:", error);
      process.exit(1);
    });
}

export { runEvaluations };

