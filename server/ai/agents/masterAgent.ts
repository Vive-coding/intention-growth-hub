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
  private static readonly MAX_FOCUS_GOALS = 3;

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
    const suggestedAgent = this.determineSuggestedAgent(context, finalText, myFocus, needsSetup);

    return {
      finalText,
      agentType: suggestedAgent,
    };
  }

  private determineSuggestedAgent(context: AgentContext, _agentResponse: string, myFocus: any, needsSetup: boolean): AgentType | undefined {
    const message = context.userMessage.toLowerCase();
    const recentMessages = context.recentMessages || [];

    const hasRecentGoalCard = recentMessages
      .slice(-4)
      .some((msg) => msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes('goal_suggestion'));

    const focusGoalCount = Array.isArray(myFocus?.priorityGoals) ? myFocus.priorityGoals.length : 0;
    const maxGoals = Math.min(Math.max(Number(myFocus?.config?.maxGoals ?? MasterAgent.MAX_FOCUS_GOALS), 3), 5);
    const genericGreeting = /^(hi|hello|hey|how are you|what's up|good (morning|afternoon|evening)|thanks|thank you)[!.\s]*$/;

    const desireKeywords = /(i want to|i need to|i plan to|i'm planning to|i'd like to|i hope to|i'm hoping to|i aim to|i should|i'm trying to|need to focus|goal|goals|my goal)/;
    const timelineKeywords = /(today|tonight|tomorrow|this week|this weekend|this month|next week|next month|by |before |after |in \d+ (day|days|week|weeks|month|months)|deadline)/;
    const intentDetected = desireKeywords.test(message);
    const timelineDetected = timelineKeywords.test(message);

    // If the user has not yet set up focus goals or habits, prompt goal creation once meaningful context exists
    if ((needsSetup || focusGoalCount === 0) && !hasRecentGoalCard && !genericGreeting.test(message)) {
      return 'suggest_goals';
    }

    // If the user hints at new goals/timelines and we have capacity, proactively surface goal suggestions
    if (!hasRecentGoalCard && focusGoalCount < maxGoals && intentDetected && timelineDetected) {
      return 'suggest_goals';
    }

    if (!hasRecentGoalCard && focusGoalCount >= maxGoals && intentDetected) {
      return 'prioritize_optimize';
    }

    // Explicit requests remain supported
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

    return undefined;
  }
}
