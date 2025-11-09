import { ChatOpenAI } from '@langchain/openai';
import { db } from "../db";
import { chatThreads } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { ChatContextService } from "../services/chatContextService";
import { and, desc } from "drizzle-orm";
import { insights, suggestedHabits, lifeMetricDefinitions } from "../../shared/schema";
import { AgentRouter } from "./agents/agentRouter";
import { AgentType } from "./agents/types";
import { processWithToolAgent } from "./singleAgent";

// Feature flag: Use new tool-based agent
const USE_TOOL_AGENT = process.env.USE_TOOL_AGENT === 'true';
console.log('[lifeCoachService] USE_TOOL_AGENT env var:', process.env.USE_TOOL_AGENT);
console.log('[lifeCoachService] USE_TOOL_AGENT flag:', USE_TOOL_AGENT);

const SYSTEM_PROMPT = `You are a supportive AI life coach who helps people achieve their goals through focused conversations.
Style: Conversational, insightful, and action-oriented. Move conversations forward with purpose.
Goal: Help users clarify their priorities and take concrete steps toward meaningful goals.
Approach:
- Listen actively and acknowledge their situation
- Ask 1-2 insightful questions to understand their context better
- When appropriate, suggest specific goals or habits that align with their needs
- Be proactive about identifying opportunities for growth and improvement
- Avoid endless Q&A - guide toward actionable next steps
- Focus on high-impact areas where they can make meaningful progress
CTA: When you suggest goals, habits, or actions, append a single token at the very end in the format CTA(<label>) with no other text after it. Examples: CTA(Review habits), CTA(View suggestions), CTA(Set goals).
Never include more than one CTA. Never include markdown fences or JSON in your response.`;

function clampTokens(text: string, maxChars = 2000): string {
  // Increased limit significantly - let context be rich
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}

function packContext(opts: {
  profile: Awaited<ReturnType<typeof ChatContextService.getProfileCapsule>>;
  workingSet: Awaited<ReturnType<typeof ChatContextService.getWorkingSet>>;
  onboardingProfile: Awaited<ReturnType<typeof ChatContextService.getOnboardingProfile>>;
  threadSummary: string | null;
  recentMessages: Array<{ role: string; content: string }>;
  userMessage: string;
}): { system: string; user: string; } {
  const { profile, workingSet, onboardingProfile, threadSummary, recentMessages, userMessage } = opts;

  const profileLine = [profile?.firstName ? `Name:${profile.firstName}` : null, profile?.timezone ? `TZ:${profile.timezone}` : null]
    .filter(Boolean)
    .join(' | ');

  const goals = (workingSet.activeGoals || []).slice(0, 5).map(g => `• ${g.title} (${g.status}${g.targetDate ? `, target ${g.targetDate.slice(0,10)}` : ''})`).join('\n');
  const habits = (workingSet.activeHabits || []).slice(0, 6).map(h => `• ${h.name} (streak ${h.streak})`).join('\n');
  const insights = (workingSet.recentInsights || []).slice(0, 5).map(i => `• ${i.title}: ${i.summary}`).join('\n');

  const onboardingData = profile?.onboarding || onboardingProfile;

  const onboardingStage = onboardingData?.onboardingStep ?? onboardingProfile?.onboardingStep ?? 'unknown';
  const firstGoalCreated = onboardingData?.firstGoalCreated ?? onboardingProfile?.firstGoalCreated ?? false;
  const firstChatSession = onboardingData?.firstChatSession ?? onboardingProfile?.firstChatSession ?? false;

  const onboardingSummary = onboardingData
    ? `Stage: ${onboardingStage} | Goal setting: ${onboardingData.goalSettingAbility ?? 'n/a'} | Habit building: ${onboardingData.habitBuildingAbility ?? 'n/a'} | Coaching: ${(onboardingData.coachingStyle || []).join(', ') || 'n/a'} | Personality: ${onboardingData.coachPersonality ?? 'default'} | Focus: ${(onboardingData.focusLifeMetrics || []).join(', ') || 'n/a'} | First goal created: ${firstGoalCreated ? 'yes' : 'no'} | First chat completed: ${firstChatSession ? 'yes' : 'no'}`
    : 'No onboarding profile captured yet.';

  const recents = recentMessages.slice(-2).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

  const composedUser = `
Profile: ${profileLine || 'n/a'}
Onboarding: ${onboardingSummary}
Thread: ${threadSummary ? clampTokens(threadSummary, 500) : 'n/a'}
Recent:
${recents}

Active Goals:
${goals || 'None'}

Active Habits:
${habits || 'None'}

Recent Insights:
${insights || 'None'}

User Message: ${userMessage}
`;

  return { system: SYSTEM_PROMPT, user: composedUser };
}

export async function streamLifeCoachReply(params: {
  userId: string;
  threadId: string;
  input: string;
  onToken: (delta: string) => void;
  onStructuredData?: (data: any) => void;
  requestedAgentType?: AgentType;
}): Promise<{ finalText: string; cta?: string; structuredData?: any }>{
  const { userId, threadId, input, onToken, onStructuredData, requestedAgentType } = params;

  // Load context
  const [profile, workingSet, recentMessages, onboardingProfile] = await Promise.all([
    ChatContextService.getProfileCapsule(userId),
    ChatContextService.getWorkingSet(userId),
    ChatContextService.getRecentMessages(threadId, 10),
    ChatContextService.getOnboardingProfile(userId),
  ]);
  const threadRow = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  const threadSummary = threadRow[0]?.summary ?? null;

  const agentContext = {
    userId,
    threadId,
    userMessage: input,
    recentMessages,
    profile,
    workingSet,
    threadSummary,
    onboardingProfile,
  };

  let result: { finalText: string; cta?: string; structuredData?: any };

  // Choose agent system based on feature flag
  console.log('[lifeCoachService] USE_TOOL_AGENT flag:', USE_TOOL_AGENT);
  console.log('[lifeCoachService] requestedAgentType:', requestedAgentType);
  
  if (USE_TOOL_AGENT) {
    console.log('[lifeCoachService] Using NEW tool-based agent');
    
    try {
      // Use new tool-based single agent
      result = await processWithToolAgent(agentContext, requestedAgentType);
      console.log('[lifeCoachService] Tool agent result:', {
        textLength: result.finalText.length,
        hasStructuredData: !!result.structuredData,
        structuredDataType: result.structuredData?.type
      });
      
      // Send structured data immediately if available (before streaming text)
      if (result.structuredData && onStructuredData) {
        console.log('[lifeCoachService] 🎴 Sending structured data immediately:', result.structuredData.type);
        onStructuredData(result.structuredData);
      }
    } catch (error) {
      console.error('[lifeCoachService] Tool agent error:', error);
      // Fallback to old system on error
      console.log('[lifeCoachService] Falling back to old agent router');
      const agentRouter = new AgentRouter();
      result = await agentRouter.processMessage(agentContext, requestedAgentType);
    }
  } else {
    console.log('[lifeCoachService] Using OLD agent router');
    // Use old agent router
    const agentRouter = new AgentRouter();
    result = await agentRouter.processMessage(agentContext, requestedAgentType);
  }

  // Stream the response
  const words = result.finalText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    onToken(i === 0 ? word : ` ${word}`);
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return {
    finalText: result.finalText,
    cta: result.cta,
    structuredData: result.structuredData,
  };
}