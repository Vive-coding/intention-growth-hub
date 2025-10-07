import { ChatOpenAI } from '@langchain/openai';
import { db } from "../db";
import { chatThreads } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { ChatContextService } from "../services/chatContextService";

const SYSTEM_PROMPT = `You are a supportive AI life coach in SMS mode. Reply in ≤2 sentences, concrete and kind. Offer exactly one suggestion or reflection.`;

function clampTokens(text: string, maxChars = 500): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function packContext(opts: {
  profile: Awaited<ReturnType<typeof ChatContextService.getProfileCapsule>>;
  workingSet: Awaited<ReturnType<typeof ChatContextService.getWorkingSet>>;
  threadSummary: string | null;
  recentMessages: Array<{ role: string; content: string }>;
  userMessage: string;
}): { system: string; user: string; } {
  const { profile, workingSet, threadSummary, recentMessages, userMessage } = opts;

  const profileLine = [profile?.firstName ? `Name:${profile.firstName}` : null, profile?.timezone ? `TZ:${profile.timezone}` : null]
    .filter(Boolean)
    .join(' | ');

  const goals = (workingSet.activeGoals || []).slice(0, 5).map(g => `• ${g.title} (${g.status}${g.targetDate ? `, target ${g.targetDate.slice(0,10)}` : ''})`).join('\n');
  const habits = (workingSet.activeHabits || []).slice(0, 6).map(h => `• ${h.name} (streak ${h.streak})`).join('\n');
  const insights = (workingSet.recentInsights || []).slice(0, 3).map(i => `• ${i.title}: ${i.summary}`).join('\n');

  const recents = recentMessages.slice(-2).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

  const composedUser = `
Profile: ${profileLine || 'n/a'}
Thread: ${threadSummary ? clampTokens(threadSummary, 500) : 'n/a'}
Recent:
${recents || 'n/a'}
Working Set:
Goals:\n${goals || '-'}
Habits:\n${habits || '-'}
Insights:\n${insights || '-'}

User message: ${userMessage}
`;

  return { system: SYSTEM_PROMPT, user: composedUser };
}

export async function streamLifeCoachReply(params: {
  userId: string;
  threadId: string;
  input: string;
  onToken: (delta: string) => void;
}): Promise<{ finalText: string }>{
  const { userId, threadId, input, onToken } = params;

  // Load context
  const [profile, workingSet, recentMessages] = await Promise.all([
    ChatContextService.getProfileCapsule(userId),
    ChatContextService.getWorkingSet(userId),
    ChatContextService.getRecentMessages(threadId, 2),
  ]);
  const threadRow = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
  const threadSummary = threadRow[0]?.summary ?? null;

  const { system, user } = packContext({ profile, workingSet, threadSummary, recentMessages, userMessage: input });

  const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0.6, maxTokens: 90 });

  let final = '';
  const stream = await model.stream([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ] as any);

  for await (const chunk of stream) {
    const delta = typeof chunk?.content === 'string' ? chunk.content : (Array.isArray(chunk?.content) ? chunk.content.map((c: any) => c?.text || '').join('') : '');
    if (delta) {
      final += delta;
      onToken(delta);
    }
  }

  // Enforce short style defensively
  if (final.split(/\.!?/).join('.').length > 400) {
    final = final.slice(0, 400);
  }

  return { finalText: final.trim() };
}


