/**
 * LangSmith Tracing Utilities
 * 
 * This module provides utilities for enhancing traces with custom metadata,
 * tags, and run context for better observability.
 */

import { Client } from "langsmith";
import type { RunCreate } from "langsmith/schemas";

// Initialize LangSmith client (if API key is available)
let langsmithClient: Client | null = null;

if (process.env.LANGCHAIN_API_KEY) {
  try {
    langsmithClient = new Client({
      apiKey: process.env.LANGCHAIN_API_KEY,
      apiUrl: process.env.LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
    });
  } catch (error) {
    console.warn("[LangSmith] Failed to initialize client:", error);
  }
}

/**
 * Generate tags for a trace based on context
 */
export function generateTraceTags(context: {
  agentType?: string;
  userId?: string;
  threadId?: string;
  mode?: string;
  toolUsed?: string;
  environment?: string;
}): string[] {
  const tags: string[] = [];
  
  if (context.agentType) {
    tags.push(`agent_type:${context.agentType}`);
  }
  
  if (context.environment) {
    tags.push(`environment:${context.environment}`);
  } else {
    tags.push(`environment:${process.env.NODE_ENV || 'development'}`);
  }
  
  if (context.mode) {
    tags.push(`mode:${context.mode}`);
  }
  
  if (context.toolUsed) {
    tags.push(`tool:${context.toolUsed}`);
  }
  
  return tags;
}

/**
 * Generate metadata for a trace
 */
export function generateTraceMetadata(context: {
  userId?: string;
  threadId?: string;
  agentType?: string;
  userMessage?: string;
  messageLength?: number;
  mode?: string;
}): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  if (context.userId) {
    metadata.user_id = context.userId;
  }
  
  if (context.threadId) {
    metadata.thread_id = context.threadId;
  }
  
  if (context.agentType) {
    metadata.agent_type = context.agentType;
  }
  
  if (context.userMessage) {
    // Store first 100 chars as preview (not full message for privacy)
    metadata.user_message_preview = context.userMessage.slice(0, 100);
    metadata.user_message_length = context.userMessage.length;
  }
  
  if (context.messageLength) {
    metadata.message_length = context.messageLength;
  }
  
  if (context.mode) {
    metadata.mode = context.mode;
  }
  
  return metadata;
}

/**
 * Create custom callbacks for enhanced tracing
 */
export function createTracingCallbacks(context: {
  agentType?: string;
  userId?: string;
  threadId?: string;
  mode?: string;
  environment?: string;
}) {
  const tags = generateTraceTags(context);
  const metadata = generateTraceMetadata(context);
  
  return [
    {
      // This will be automatically called by LangChain
      handleChainStart: (chain: any, inputs: any, runId: string, parentRunId?: string) => {
        // Metadata is automatically included via LangChain's built-in tracing
        // Tags are set via environment or in the chain config
      },
      handleLLMStart: (llm: any, prompts: string[], runId: string) => {
        // Track LLM invocation
        if (langsmithClient) {
          // This is handled automatically, but we can add custom logic here if needed
        }
      },
      handleToolStart: (tool: any, input: string, runId: string, parentRunId?: string) => {
        // Track tool usage
        const toolName = tool?.name || "unknown_tool";
        
        if (langsmithClient) {
          // Custom tool tracking could go here
          // Note: LangChain already tracks tools automatically via built-in callbacks
        }
      },
    },
  ];
}

/**
 * Submit feedback for a trace run
 */
export async function submitFeedback(runId: string, feedback: {
  score: number; // 0-1 or 1-5
  comment?: string;
  feedbackType: 'explicit' | 'implicit';
  metadata?: Record<string, any>;
}): Promise<void> {
  if (!langsmithClient) {
    console.warn("[LangSmith] Client not initialized, skipping feedback submission");
    return;
  }
  
  try {
    await langsmithClient.createFeedback(runId, feedback.feedbackType, {
      score: feedback.score,
      comment: feedback.comment,
      value: feedback.score,
      ...feedback.metadata,
    });
    
    console.log(`[LangSmith] Feedback submitted for run ${runId}:`, feedback.score);
  } catch (error) {
    console.error("[LangSmith] Failed to submit feedback:", error);
  }
}

/**
 * Get project name based on environment
 */
export function getProjectName(): string {
  return process.env.LANGCHAIN_PROJECT || `intention-growth-hub-${process.env.NODE_ENV || 'dev'}`;
}

export { langsmithClient };

