import { ChatOpenAI } from '@langchain/openai';

interface HabitSuggestionRequest {
  goalTitle: string;
  goalDescription: string;
  lifeMetric: string;
  userId: string;
  limit?: number;
}

interface HabitSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  score: number;
  isNew?: boolean;
}

export async function generateHabitSuggestions(request: HabitSuggestionRequest): Promise<HabitSuggestion[]> {
  const { goalTitle, goalDescription, lifeMetric, userId, limit = 5 } = request;

  const prompt = `
You are an expert life coach and habit formation specialist. Generate ${limit} high-leverage, specific habit suggestions for the following goal:

GOAL: ${goalTitle}
DESCRIPTION: ${goalDescription}
LIFE METRIC: ${lifeMetric}

CRITERIA FOR HABIT SUGGESTIONS:
1. **High Leverage**: Each habit should have maximum impact on achieving the goal
2. **Specific & Actionable**: Clear, concrete actions the user can take
3. **Shareable**: Habits that can be easily communicated and understood
4. **Sustainable**: Realistic and maintainable long-term
5. **Measurable**: Clear completion criteria

FORMAT: Return a JSON array of habit objects with:
- title: Short, clear habit name (max 50 chars)
- description: Detailed explanation of the habit (max 200 chars)
- category: Life metric category
- priority: 1 (essential), 2 (helpful), or 3 (optional)

EXAMPLES:
{
  "title": "Daily 10-minute meditation",
  "description": "Practice mindfulness meditation for 10 minutes each morning to improve focus and reduce stress",
  "category": "${lifeMetric}",
  "priority": 1
}

Generate ${limit} unique, high-quality habit suggestions that directly support this goal.
`;

  try {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 1000
    });

    const response = await model.invoke([
      {
        role: "system",
        content: "You are an expert life coach specializing in habit formation and goal achievement. Always respond with valid JSON arrays."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    const content = response.content as string;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response - handle potential markdown formatting
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const suggestions = JSON.parse(cleanContent);
    
    // Add metadata to each suggestion
    return suggestions.map((suggestion: any, index: number) => ({
      id: `suggested-${userId}-${Date.now()}-${index}`,
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category || lifeMetric,
      score: 0.9 - (index * 0.1), // Decreasing score for ranking
      isNew: true
    }));

  } catch (error) {
    console.error("Error generating habit suggestions:", error);
    
    // Fallback suggestions if AI fails
    return [
      {
        id: `fallback-${userId}-${Date.now()}-1`,
        title: `Daily ${lifeMetric.toLowerCase()} practice`,
        description: `Spend 15 minutes daily working on ${goalTitle.toLowerCase()} to build consistent progress`,
        category: lifeMetric,
        score: 0.8,
        isNew: true
      },
      {
        id: `fallback-${userId}-${Date.now()}-2`,
        title: `Weekly ${lifeMetric.toLowerCase()} review`,
        description: `Review progress on ${goalTitle.toLowerCase()} every week and adjust approach as needed`,
        category: lifeMetric,
        score: 0.7,
        isNew: true
      }
    ];
  }
}
