import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

export type ModelName = "gpt-5-mini" | "claude-haiku" | "claude-opus";

/**
 * Validate if a user has access to a specific model
 * @param userId - User ID to check
 * @param modelName - Model name to validate
 * @returns true if user has access, false otherwise
 */
export async function validateModelAccess(
  userId: string,
  modelName: ModelName
): Promise<boolean> {
  // GPT-5-mini is always available to all users
  if (modelName === "gpt-5-mini") {
    return true;
  }

  // Claude Haiku is free for all users
  if (modelName === "claude-haiku") {
    return true;
  }

  // Claude Opus requires premium access
  if (modelName === "claude-opus") {
    try {
      const [user] = await db
        .select({ isPremium: users.isPremium })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user?.isPremium === true;
    } catch (error) {
      console.error("[modelService] Error validating model access:", error);
      return false;
    }
  }

  // Unknown model - deny access
  return false;
}

/**
 * Get user's preferred model, with fallback to default
 * @param userId - User ID
 * @returns Model name or null if not set
 */
export async function getUserPreferredModel(
  userId: string
): Promise<ModelName | null> {
  try {
    const [user] = await db
      .select({ preferredModel: users.preferredModel })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const validModels = ["gpt-5-mini", "claude-haiku", "claude-opus"];
    if (user?.preferredModel && validModels.includes(user.preferredModel)) {
      return user.preferredModel as ModelName;
    }

    return null;
  } catch (error) {
    console.error("[modelService] Error getting user preferred model:", error);
    return null;
  }
}

/**
 * Get the model to use for a thread, with fallbacks
 * @param userId - User ID
 * @param threadModel - Model stored on thread (if any)
 * @returns Model name to use
 */
export async function getModelForThread(
  userId: string,
  threadModel: string | null | undefined
): Promise<ModelName> {
  const validModels = ["gpt-5-mini", "claude-haiku", "claude-opus"];
  
  // If thread has a model set, use it (but validate access)
  if (threadModel && validModels.includes(threadModel)) {
    const hasAccess = await validateModelAccess(userId, threadModel as ModelName);
    if (hasAccess) {
      return threadModel as ModelName;
    }
    // If user doesn't have access, fall through to user preference
  }

  // Fallback to user's preferred model
  const userPreferred = await getUserPreferredModel(userId);
  if (userPreferred) {
    const hasAccess = await validateModelAccess(userId, userPreferred);
    if (hasAccess) {
      return userPreferred;
    }
  }

  // Default to GPT-5-mini
  return "gpt-5-mini";
}
