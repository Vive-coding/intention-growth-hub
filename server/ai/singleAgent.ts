/**
 * Single Tool-Calling Life Coach Agent
 * 
 * Replaces the multi-agent architecture with one intelligent agent
 * that has access to 11 specialized tools for goal/habit management.
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor } from "langchain/agents";
import { createToolsForUser } from "./tools/index";
import type { AgentContext } from "./agents/types";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { RunnableSequence } from "@langchain/core/runnables";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

const LIFE_COACH_PROMPT = `You are an experienced life coach helping users achieve their goals through intentional action and habit formation.

Your personality: Warm, empathetic, curious, strategic, and genuinely invested in their success.

## CONTEXT & MEMORY:
- You have access to chat history - use it! Don't repeat questions or re-fetch info you already have.
- Only call get_context("my_focus") at the START of a NEW chat thread (when chat history is empty or minimal).
- Within an ongoing conversation, rely on what you've already learned from prior messages.

## YOUR TOOLS (use proactively):
1. **get_context** - Get user's current goals, habits, insights, life metrics
   - Use: Start of new threads, or when user asks "where am I at?"
   
2. **create_goal_with_habits** - Create new goals with supporting habits
   - Use: When user wants to work toward something new
   
3. **suggest_habits_for_goal** - Suggest habits for existing goals
   - Use: When user is stuck or struggling with a goal
   
4. **update_goal_progress** - Update progress on goals
   - Use: When user shares wins or progress updates
   
5. **complete_goal** - Mark goals as complete and celebrate
   - Use: When user achieves a goal
   
6. **adjust_goal** - Modify target dates, urgency, or details
   - Use: When life circumstances change
   
7. **review_daily_habits** - Show interactive daily habit checklist
   - Use: When user wants to log habits or asks "what should I do today?"
   - IMPORTANT: When calling this tool, provide ONLY a brief encouraging summary in your text response. Do NOT list out the habits - the interactive card will show them all.
   
8. **update_habit** - Pause, resume, or modify habits
   - Use: When habits need adjustment
   
9. **share_insight** - Capture breakthrough realizations
   - Use: ONLY when user confirms a deep insight resonates with them
   
10. **show_progress_summary** - Visual dashboard of progress
    - Use: When user asks how they're doing or wants motivation

## WHEN TO TAKE ACTION:
- **Proactive**: If conversation is going in circles or user seems stuck, suggest using a tool
- **Responsive**: When user explicitly asks or shares relevant info (wins, struggles, new goals)
- **Natural**: Gather needed info through conversation first, then call tools

## INFORMATION GATHERING (before tool calls):
- Goals need: title, life_metric, importance, target_date, urgency
- Habits need: title, frequency, linked goals
- Ask 1-2 questions at a time, keep it conversational

## COACHING PRINCIPLES:
- Celebrate wins enthusiastically
- Ask "Why does this matter to you?" to uncover deeper motivation
- When stuck, explore: What's blocking you? What would one small step be?
- Think holistically - balance across life areas
- Make conversations feel human, not robotic

## EXAMPLES:
- New thread: "Hi!" → Call get_context("my_focus"), then respond with their current state
- Ongoing chat: "I'm feeling stuck" → Use chat history to understand context, suggest specific actions
- Win shared: "I finished my workout!" → Celebrate, then call update_goal_progress or review_daily_habits
- Habit review: "Let me review my habits" → Call review_daily_habits, respond with brief summary like "Here's your habit checklist for today! Check off what you've completed." (card shows the actual habits)
- Circles: User keeps talking without action → "Let's capture this as a goal - what would you like to achieve?"

Remember: You're a coach who takes action. Use tools to move conversations forward, not just to chat! When tools show interactive cards, keep your text response brief and don't duplicate the card's content.`;

/**
 * Create the tool-calling agent with specific tools
 */
export async function createLifeCoachAgentWithTools(tools: any[]): Promise<AgentExecutor> {
  console.log("[createLifeCoachAgent] Creating agent with tools:", tools.map(t => t.name));
  
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 800,
  });

  // CRITICAL: Convert tools to OpenAI function format
  // Use LangChain's utility to properly convert Zod schemas to JSON Schema
  const modelWithTools = model.bind({
    functions: tools.map(tool => convertToOpenAIFunction(tool)),
  });

  console.log("[createLifeCoachAgent] Tools bound to model");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", LIFE_COACH_PROMPT],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Create agent chain manually
  const agent = RunnableSequence.from([
    {
      input: (i: { input: string; chat_history: any[]; steps: any[] }) => i.input,
      chat_history: (i: { input: string; chat_history: any[]; steps: any[] }) => i.chat_history,
      agent_scratchpad: (i: { input: string; chat_history: any[]; steps: any[] }) => 
        formatToOpenAIFunctionMessages(i.steps),
    },
    prompt,
    modelWithTools,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  console.log("[createLifeCoachAgent] Agent chain created successfully");

  const executor = new AgentExecutor({
    agent,
    tools, // Use the tools passed in (which may be bound with context)
    verbose: true,
    maxIterations: 10,
    returnIntermediateSteps: true,
    handleParsingErrors: true,
  });

  console.log("[createLifeCoachAgent] AgentExecutor created");
  console.log("[createLifeCoachAgent] Tools available:", tools.map(t => t.name));
  
  return executor;
}

/**
 * Process a message with the tool-calling agent
 * This is the main entry point that will replace AgentRouter
 */
export async function processWithToolAgent(context: AgentContext): Promise<{
  finalText: string;
  structuredData?: any;
  cta?: string;
  toolCalls?: Array<{ tool: string; input: any; output: any }>;
}> {
  const { userMessage, profile, workingSet, threadSummary, recentMessages, userId } = context;
  
  try {
    console.log("\n=== [processWithToolAgent] Starting agent processing ===");
    console.log("[processWithToolAgent] User:", userId);
    console.log("[processWithToolAgent] Thread:", context.threadId);
    console.log("[processWithToolAgent] Message:", userMessage);
    
    // Create tools with userId and threadId baked in
    const toolsForUser = createToolsForUser(userId, context.threadId);
    console.log("[processWithToolAgent] Created tools for user:", userId);
    
    // Create agent with user-specific tools
    const agentExecutor = await createLifeCoachAgentWithTools(toolsForUser);
    
    // Format chat history for agent
    const chatHistory = recentMessages.slice(-6).map(msg => ({
      role: msg.role === "user" ? "human" : "ai",
      content: msg.content
    }));
    
    console.log("[processWithToolAgent] Chat history length:", chatHistory.length);
    
    // Build context string for agent
    const contextString = `
Profile: ${profile?.firstName || 'User'}
Thread: ${threadSummary || 'New conversation'}

Recent context:
${recentMessages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}
`;
    
    console.log("[processWithToolAgent] Invoking agent...");
    
    // Invoke agent with tools
    // Pass userId and threadId via config for tools to access
    const result = await agentExecutor.invoke(
      {
        input: userMessage,
        chat_history: chatHistory,
        steps: [], // Initialize steps for the agent
      }, 
      {
        configurable: {
          userId,
          threadId: context.threadId,
        },
        callbacks: [{
          handleLLMEnd: (output: any) => {
            console.log("\n🤖 [LLM Response]");
            const generation = output.generations?.[0]?.[0];
            if (generation?.message?.tool_calls?.length > 0) {
              console.log("✅ LLM decided to use tools:");
              generation.message.tool_calls.forEach((tc: any) => {
                console.log(`  - Tool: ${tc.name}`);
                console.log(`    Args: ${JSON.stringify(tc.args, null, 2)}`);
              });
            } else if (generation?.text) {
              console.log("💬 LLM returned text only (NO TOOLS):");
              console.log(`  "${generation.text}"`);
            } else {
              console.log("⚠️  LLM returned empty response");
            }
          },
          handleToolStart: (tool: any, input: string) => {
            console.log(`\n🔧 [Tool Execution Started]: ${tool.name}`);
            console.log(`   Input: ${input}`);
          },
          handleToolEnd: (output: string) => {
            console.log(`✅ [Tool Execution Complete]`);
            console.log(`   Output: ${output.substring(0, 200)}...`);
          },
          handleToolError: (error: Error) => {
            console.log(`❌ [Tool Execution Error]: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
          },
        }]
      }
    );
    
    console.log("\n=== [processWithToolAgent] Agent result ===");
    console.log("Output:", result.output);
    console.log("Intermediate steps count:", result.intermediateSteps?.length || 0);
    if (result.intermediateSteps?.length > 0) {
      console.log("Tool calls executed:");
      result.intermediateSteps.forEach((step: any, i: number) => {
        console.log(`  ${i + 1}. ${step.action?.tool}:`, {
          input: step.action?.toolInput,
          output: typeof step.observation === 'string' ? step.observation.substring(0, 100) : step.observation
        });
      });
    } else {
      console.log("⚠️  NO TOOLS WERE EXECUTED - Agent returned text only");
    }
    console.log("=== End agent result ===\n");
    
    // Extract tool outputs for structured data
    const toolOutputs = result.intermediateSteps?.map((step: any) => ({
      tool: step.action.tool,
      input: step.action.toolInput,
      output: step.observation
    })) || [];
    
    // Find structured data from tool outputs
    // Tools that return cards should have a 'type' property (e.g., 'habit_review', 'goal_suggestion')
    let structuredData = null;
    for (const toolOutput of toolOutputs) {
      try {
        // Tool outputs come as JSON strings, parse them
        const output = typeof toolOutput.output === 'string' 
          ? JSON.parse(toolOutput.output) 
          : toolOutput.output;
        
        if (output && typeof output === 'object' && output.type) {
          // This is a card-generating tool output
          structuredData = output;
          console.log("[processWithToolAgent] ✅ Found structured data with type:", output.type);
          console.log("[processWithToolAgent] Full structured data:", JSON.stringify(structuredData, null, 2));
          break;
        }
      } catch (e) {
        // Not JSON or not a card, skip
        continue;
      }
    }
    
    // If the agent returns empty output, provide a helpful fallback
    let finalText = result.output;
    if (!finalText || finalText.trim() === "") {
      console.warn("[processWithToolAgent] Agent returned empty output, using fallback");
      finalText = "I'm here to support you in achieving your goals. What would you like to focus on today?";
    }
    
    return {
      finalText,
      structuredData,
      toolCalls: toolOutputs,
    };
    
  } catch (error) {
    console.error("[processWithToolAgent] Error:", error);
    console.error("[processWithToolAgent] Error stack:", (error as Error).stack);
    return {
      finalText: "I'm here to help you with your goals. What's on your mind today?",
      structuredData: null,
    };
  }
}

/**
 * Stream version for SSE responses
 * (We can implement this later - for now, use invoke and stream the final result)
 */
export async function streamWithToolAgent(context: AgentContext, onToken: (delta: string) => void): Promise<{
  finalText: string;
  structuredData?: any;
}> {
  // For now, invoke and stream the result
  // TODO: Implement proper streaming with streamEvents
  const result = await processWithToolAgent(context);
  
  // Stream the final text token by token
  const text = result.finalText;
  for (let i = 0; i < text.length; i++) {
    onToken(text[i]);
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return {
    finalText: result.finalText,
    structuredData: result.structuredData,
  };
}

