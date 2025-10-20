import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType } from "./types";
import { ChatContextService } from "../../services/chatContextService";
import { MyFocusService } from "../../services/myFocusService";

const MASTER_AGENT_SYSTEM_PROMPT = `You are a master life coach conducting conversations with users to help them achieve their goals and build better habits. Your role is to:

1. **Conduct directive conversations** - Ask fewer but better questions to gather quality information, then make decisions about next steps.

2. **Focus on "My Focus"** - Always consider the user's current priority goals, high-leverage habits, and key insights. Either reinforce their current focus OR suggest changes based on what they're discussing.

3. **Plan/Reflect Cycle** - Alternate between:
   - **PLAN MODE**: Help user plan their day around current focus
   - **REFLECT MODE**: Review progress and provide insights

4. **Smart Agent Transitions** - When you have enough information, decide whether to:
   - Stay in master mode (reinforce current focus)
   - Switch to suggest goals (if focus needs change)
   - Switch to review progress (if user needs reflection)
   - Switch to optimize (if user feels overwhelmed)
   - Switch to surprise me (if user wants insights)

**Conversation Style:**
- Directive but empathetic
- Ask 1-2 high-quality questions maximum
- Make clear decisions about next steps
- Focus on actionable outcomes
- Be confident in your recommendations

**Context about the user:**
{profile}
{workingSet}
{myFocus}
{threadSummary}

**Recent conversation:**
{recentMessages}

Remember: Your goal is to help them achieve their current focus OR intelligently suggest changes when needed. Make decisions quickly based on quality information.`;

export class MasterAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 400,
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userMessage, profile, workingSet, threadSummary, recentMessages, userId } = context;

    // Get My Focus data
    const myFocus = await MyFocusService.getMyFocus(userId);
    const needsSetup = await MyFocusService.needsInitialSetup(userId);

    // Format recent messages for context
    const recentMessagesText = recentMessages
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = MASTER_AGENT_SYSTEM_PROMPT
      .replace('{profile}', JSON.stringify(profile, null, 2))
      .replace('{workingSet}', JSON.stringify(workingSet, null, 2))
      .replace('{myFocus}', JSON.stringify({ ...myFocus, needsSetup }, null, 2))
      .replace('{threadSummary}', threadSummary || 'No thread summary available')
      .replace('{recentMessages}', recentMessagesText);

    const response = await this.model.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage }
    ]);

    const finalText = response.content as string;

    // Determine if we should suggest a special agent
    const suggestedAgent = this.determineSuggestedAgent(userMessage, finalText, myFocus, needsSetup);

    return {
      finalText,
      agentType: suggestedAgent,
    };
  }

  private determineSuggestedAgent(userMessage: string, agentResponse: string, myFocus: any, needsSetup: boolean): AgentType | undefined {
    const message = userMessage.toLowerCase();
    const response = agentResponse.toLowerCase();

    // If user needs initial setup, suggest prioritize/optimize agent
    if (needsSetup && (message.includes('start') || message.includes('begin') || message.includes('setup'))) {
      return 'prioritize_optimize';
    }

    // Only suggest special agents for very explicit requests
    if (message.includes('review my progress') || message.includes('check my habits') || message.includes('how am i doing')) {
      return 'review_progress';
    }
    if (message.includes('suggest goals') || message.includes('new goals') || message.includes('goal recommendations')) {
      return 'suggest_goals';
    }
    if (message.includes('prioritize') || message.includes('optimize') || message.includes('too many goals')) {
      return 'prioritize_optimize';
    }
    if (message.includes('surprise me') || message.includes('insights about me') || message.includes('tell me about myself')) {
      return 'surprise_me';
    }

    // Don't automatically suggest agents based on response content
    // Let users explicitly request special interactions
    return undefined;
  }
}
