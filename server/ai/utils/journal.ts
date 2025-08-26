// Lightweight helpers to auto-generate a short title and classify mood from free text

const EMOJI_MOODS = [
  'happy',
  'grateful',
  'excited',
  'peaceful',
  'thoughtful',
  'motivated',
  'tired',
  'stressed',
  'sad',
  'anxious',
  'neutral',
] as const;

export type Mood = typeof EMOJI_MOODS[number];

function normalize(text: string): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Comprehensive keyword lists for better mood detection
const MOOD_KEYWORDS: Record<Mood, string[]> = {
  happy: ['happy', 'joy', 'smile', 'great day', 'good day', 'glad', 'amazing', 'wonderful', 'fantastic', 'awesome', 'excellent', 'brilliant', 'lovely', 'beautiful', 'perfect', 'delighted', 'pleased', 'cheerful', 'bright', 'sunny'],
  grateful: ['grateful', 'thankful', 'appreciate', 'appreciation', 'gratitude', 'blessed', 'fortunate', 'lucky', 'thank you', 'thanks', 'appreciative'],
  excited: ['excited', 'thrilled', 'pumped', 'can\'t wait', 'looking forward', 'eager', 'enthusiastic', 'energized', 'energetic', 'vibrant', 'alive', 'buzzing', 'stoked', 'amped'],
  peaceful: ['calm', 'peaceful', 'relaxed', 'easy going', 'serene', 'tranquil', 'quiet', 'gentle', 'soft', 'smooth', 'comfortable', 'at ease', 'content', 'satisfied'],
  thoughtful: ['reflect', 'reflection', 'thinking', 'ponder', 'consider', 'contemplative', 'meditative', 'mindful', 'aware', 'conscious', 'insightful', 'deep', 'meaningful'],
  motivated: ['motivated', 'determined', 'drive', 'driven', 'focused', 'productive', 'ambitious', 'goal-oriented', 'purposeful', 'committed', 'dedicated', 'passionate', 'inspired', 'energized'],
  tired: ['tired', 'exhausted', 'sleepy', 'fatigued', 'drained', 'worn out', 'spent', 'weary', 'lethargic', 'sluggish', 'slow', 'heavy'],
  stressed: ['stressed', 'stressful', 'pressure', 'overwhelmed', 'anxious about', 'tense', 'strained', 'worried', 'concerned', 'frustrated', 'irritated', 'annoyed', 'bothered'],
  sad: ['sad', 'down', 'upset', 'depressed', 'cry', 'melancholy', 'blue', 'gloomy', 'disappointed', 'discouraged', 'hopeless', 'lonely', 'isolated'],
  anxious: ['anxious', 'anxiety', 'worried', 'nervous', 'uneasy', 'restless', 'jittery', 'on edge', 'tense', 'fearful', 'scared', 'afraid', 'panicked', 'overwhelmed'],
  neutral: [],
};

export function classifyMoodFromContent(content: string): Mood {
  const text = normalize(content);
  console.log('[MOOD] Keyword analysis on normalized text:', text.substring(0, 100) + '...');
  
  // simple scoring by keyword hits
  const scores: Record<Mood, number> = Object.fromEntries(
    (EMOJI_MOODS as readonly Mood[]).map((m) => [m, 0])
  ) as Record<Mood, number>;

  for (const mood of EMOJI_MOODS) {
    const keys = MOOD_KEYWORDS[mood];
    for (const k of keys) {
      if (k && text.includes(k)) {
        scores[mood] += k.length; // weight by token length
        console.log(`[MOOD] Found keyword '${k}' for mood '${mood}', score: ${scores[mood]}`);
      }
    }
  }
  
  // favor happy/peaceful over neutral if ties > 0
  let best: Mood = 'neutral';
  let bestScore = 0;
  for (const mood of EMOJI_MOODS) {
    if (scores[mood] > bestScore) {
      best = mood; bestScore = scores[mood];
    }
  }
  
  console.log('[MOOD] Final scores:', scores);
  console.log('[MOOD] Best mood:', best, 'with score:', bestScore);
  
  return bestScore > 0 ? best : 'neutral';
}

export function generateShortTitle(content: string): string {
  const text = normalize(content);
  if (!text) return 'Journal entry';
  const first = text.split(/[.!?]/)[0] || text;
  const tokens = first
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((w) => !['the','a','an','and','or','but','if','then','for','of','to','in','on','with','by','at','from','this','that','it','was','were','is','are','be','been','being','i','we','you','our','my','me','us'].includes(w));
  // Take 5-7 words per product request
  const slice = tokens.slice(0, Math.max(5, Math.min(7, tokens.length)));
  const title = slice.map((w, i) => (i === 0 ? (w.charAt(0).toUpperCase() + w.slice(1)) : w)).join(' ');
  return title || 'Journal entry';
}

export function looksGenericTitle(title?: string | null): boolean {
  if (!title) return true;
  const t = normalize(title);
  if (t.length < 3) return true;
  return /^journal entry(\s*-|\s*–|\s*—|\s*\d|\s*$)/i.test(title);
}

// Optional LLM helpers (fallback to deterministic if not available)
export async function generateTitleLLM(content: string): Promise<string> {
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({ modelName: process.env.CHAT_MODEL || 'gpt-4o-mini', temperature: 0.3 });
    const prompt = `Write a concise title (5-7 words), no ending punctuation, title case, describing this journal entry:\n---\n${content}\n---`;
    const res = await model.invoke(prompt);
    const text = String((res as any).content || '').trim();
    return text.split('\n')[0].replace(/[.!?]+$/,'').slice(0, 80) || generateShortTitle(content);
  } catch {
    return generateShortTitle(content);
  }
}

export async function classifyMoodLLM(content: string): Promise<Mood> {
  try {
    console.log('[MOOD] Starting LLM mood analysis for content length:', content.length);
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({ modelName: process.env.CHAT_MODEL || 'gpt-4o-mini', temperature: 0 });
    console.log('[MOOD] Using model:', process.env.CHAT_MODEL || 'gpt-4o-mini');
    
    const prompt = `Classify the predominant mood of the journal into one of these labels only: happy, grateful, excited, peaceful, thoughtful, motivated, tired, stressed, sad, anxious, neutral. Respond with just the label.\nText:\n${content}`;
    console.log('[MOOD] Sending prompt to OpenAI...');
    
    const res = await model.invoke(prompt);
    const label = String((res as any).content || '').toLowerCase().trim();
    console.log('[MOOD] OpenAI response:', label);
    
    if ((EMOJI_MOODS as readonly Mood[]).includes(label as Mood)) {
      console.log('[MOOD] Valid mood label returned:', label);
      return label as Mood;
    }
    
    console.log('[MOOD] Invalid mood label, falling back to keyword analysis');
    return classifyMoodFromContent(content);
  } catch (error) {
    console.error('[MOOD] Error in LLM mood analysis:', error);
    console.log('[MOOD] Falling back to keyword analysis');
    return classifyMoodFromContent(content);
  }
}

export async function generateTagsLLM(content: string, max = 5): Promise<string[]> {
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({ modelName: process.env.CHAT_MODEL || 'gpt-4o-mini', temperature: 0.2 });
    const prompt = `Generate ${max} short, lowercase tags (1-2 words) relevant to this journal, comma-separated.\nText:\n${content}`;
    const res = await model.invoke(prompt);
    const raw = String((res as any).content || '').toLowerCase();
    const tags = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, max);
    return Array.from(new Set(tags));
  } catch {
    // simple keyword fallback
    const text = normalize(content);
    const tags: string[] = [];
    if (/(work|job|career|interview)/.test(text)) tags.push('work');
    if (/(family|kids|parent|spouse)/.test(text)) tags.push('family');
    if (/(exercise|run|workout|fitness)/.test(text)) tags.push('fitness');
    if (/(finance|money|bank|invest)/.test(text)) tags.push('finance');
    if (/(stress|anxious|tired|sleep)/.test(text)) tags.push('wellness');
    return tags.slice(0, max);
  }
}


