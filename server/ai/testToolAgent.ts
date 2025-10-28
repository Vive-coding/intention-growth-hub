/**
 * Test script for the new tool-based agent
 * 
 * Run with: USE_TOOL_AGENT=true npx tsx server/ai/testToolAgent.ts
 */

import { processWithToolAgent } from "./singleAgent";

async function testAgent() {
  console.log('\n🧪 Testing Tool-Based Agent\n');
  
  // Mock context
  const testContext = {
    userId: "test-user-123",
    threadId: "test-thread-456",
    userMessage: "I want to get better at my career",
    recentMessages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi! I'm here to help you achieve your goals." }
    ],
    profile: {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      timezone: "America/New_York"
    },
    workingSet: {
      activeGoals: [],
      activeHabits: [],
      recentInsights: []
    },
    threadSummary: "New conversation about career growth"
  };
  
  try {
    console.log('📨 Sending message:', testContext.userMessage);
    console.log('⏳ Processing with tool agent...\n');
    
    const result = await processWithToolAgent(testContext);
    
    console.log('✅ Agent Response:\n');
    console.log('Text:', result.finalText);
    console.log('\n📊 Structured Data:', result.structuredData ? JSON.stringify(result.structuredData, null, 2) : 'None');
    console.log('\n🔧 Tool Calls:', result.toolCalls?.length || 0);
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('\nTool Details:');
      result.toolCalls.forEach((tc, i) => {
        console.log(`  ${i + 1}. ${tc.tool}`);
        console.log(`     Input:`, JSON.stringify(tc.input).slice(0, 100));
      });
    }
    
    console.log('\n✅ Test completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run test
testAgent().catch(console.error);

