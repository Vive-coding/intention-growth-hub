import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ModelName = "gpt-5-mini" | "claude-haiku" | "claude-opus";

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  maxCompletionTokens?: number;
  [key: string]: any;
}

// Options that should NOT be passed to Anthropic models
const OPENAI_ONLY_OPTIONS = [
  'topP', 'top_p', 'frequencyPenalty', 'frequency_penalty', 
  'presencePenalty', 'presence_penalty', 'logitBias', 'logit_bias',
  'n', 'stop', 'user', 'openAIApiKey', 'modelName', 'streaming'
];

/**
 * Filter out OpenAI-specific options for Anthropic models
 */
function filterAnthropicOptions(options: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!OPENAI_ONLY_OPTIONS.includes(key) && value !== undefined && value !== -1) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Create a chat model instance based on the model name
 * @param modelName - The model identifier ('gpt-5-mini', 'claude-haiku', or 'claude-opus')
 * @param options - Optional model configuration (temperature, maxTokens, etc.)
 * @returns A BaseChatModel instance (ChatOpenAI or ChatAnthropic)
 */
export function createModel(
  modelName: ModelName,
  options: ModelOptions = {}
): BaseChatModel {
  const { temperature, maxTokens, maxCompletionTokens, ...restOptions } = options;

  switch (modelName) {
    case "gpt-5-mini": {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      return new ChatOpenAI({
        model: "gpt-5-mini",
        openAIApiKey: openaiKey,
        temperature: temperature,
        maxTokens: maxTokens,
        ...restOptions,
      });
    }

    case "claude-haiku": {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }

      // Filter out OpenAI-specific options
      const anthropicOptions = filterAnthropicOptions(restOptions);
      const resolvedMaxTokens = maxCompletionTokens || maxTokens || 4096;

      // Claude Haiku 4.5 - fast, free tier model
      // IMPORTANT:
      // In our installed @langchain/anthropic version, the request payload always includes BOTH
      // `temperature` and `top_p` unless you explicitly null one of them (null -> undefined -> omitted).
      // Anthropic rejects requests that include both for these Claude 4.5 model IDs.
      // So we: set `temperature: null` (omit), and set `topP: 1` (valid; avoids -1 sentinel).
      return new ChatAnthropic({
        model: "claude-haiku-4-5-20251001",
        anthropicApiKey: anthropicKey,
        maxTokens: resolvedMaxTokens,
        temperature: null as any,
        topP: 1,
        ...anthropicOptions,
      });
    }

    case "claude-opus": {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }

      // Filter out OpenAI-specific options
      const anthropicOptions = filterAnthropicOptions(restOptions);
      const resolvedMaxTokens = maxCompletionTokens || maxTokens || 4096;

      // Claude Opus 4.5 - premium model
      return new ChatAnthropic({
        model: "claude-opus-4-5-20251101",
        anthropicApiKey: anthropicKey,
        maxTokens: resolvedMaxTokens,
        temperature: null as any,
        topP: 1,
        ...anthropicOptions,
      });
    }

    default:
      throw new Error(`Unknown model: ${modelName}`);
  }
}

/**
 * Get the default model name (fallback)
 */
export function getDefaultModel(): ModelName {
  return "gpt-5-mini";
}
