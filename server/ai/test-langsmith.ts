/**
 * Test script to verify LangSmith tracing is working
 * Run with: npm run dev (or tsx server/ai/test-langsmith.ts)
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { ChatOpenAI } from "@langchain/openai";

async function testLangSmithTracing() {
  console.log("🧪 Testing LangSmith tracing...");
  console.log("Environment check:");
  console.log("  LANGCHAIN_TRACING_V2:", process.env.LANGCHAIN_TRACING_V2);
  console.log("  LANGCHAIN_PROJECT:", process.env.LANGCHAIN_PROJECT);
  console.log("  LANGCHAIN_API_KEY:", process.env.LANGCHAIN_API_KEY ? "✓ Set" : "✗ Missing");

  if (!process.env.LANGCHAIN_API_KEY) {
    console.error("❌ LANGCHAIN_API_KEY not set. Please add it to your .env file.");
    process.exit(1);
  }

  try {
    // Create a simple LangChain model - this should automatically trace
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    console.log("\n📡 Making a test LLM call...");
    const response = await model.invoke([
      {
        role: "system",
        content: "You are a helpful assistant. Answer briefly."
      },
      {
        role: "user",
        content: "Say 'LangSmith tracing is working!' and nothing else."
      }
    ]);

    console.log("✅ LLM Response:", response.content);
    console.log("\n✨ Test complete! Check your LangSmith dashboard at https://smith.langchain.com");
    console.log("   You should see a trace for this test call in the 'intention-growth-hub-dev' project.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error testing LangSmith:", error);
    process.exit(1);
  }
}

testLangSmithTracing();

