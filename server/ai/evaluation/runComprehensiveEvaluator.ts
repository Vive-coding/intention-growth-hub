/**
 * Run the "Comprehensive judge evaluator" against LangSmith runs.
 *
 * This script uses the LangSmith JS SDK plus an LLM-as-judge prompt that
 * mirrors your existing evaluator. It:
 *  - Fetches one or more runs from the `intention-growth-hub-production` project
 *  - Reconstructs a conversation transcript from the run inputs
 *  - Asks an LLM (gpt-4o-mini by default) to score the conversation
 *  - Logs the result back to LangSmith as feedback on the run
 *
 * Usage (from intention-growth-hub/):
 *
 *   NODE_ENV=development tsx server/ai/evaluation/runComprehensiveEvaluator.ts --run-id <run_id>
 *   NODE_ENV=development tsx server/ai/evaluation/runComprehensiveEvaluator.ts --count 50
 */

import { Client } from "langsmith";
import type { Run } from "langsmith/schemas";
import { runEvaluator, type EvaluationResult } from "langsmith/evaluation";
import { ChatOpenAI } from "@langchain/openai";

const PROJECT_NAME =
  process.env.LANGCHAIN_PROJECT || "intention-growth-hub-production";

// NOTE: LangSmith currently does not expose the UI-configured evaluator
// directly via ID in the JS SDK. Instead, we mirror your existing
// "Comprehensive judge evaluator" prompt here and write the results
// back as feedback. You will see these in the Feedback tab in LangSmith.

const model = new ChatOpenAI({
  model: "gpt-4o-mini", // Update to gpt-5-mini when available
  temperature: 0.1,
  maxTokens: 2000,
});

type SimpleMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function normaliseRole(role: any): SimpleMessage["role"] {
  if (role === "human" || role === "user") return "user";
  if (role === "ai" || role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
}

/**
 * Best-effort extraction of a conversation transcript from a LangSmith Run.
 *
 * This looks for:
 *  - inputs.all_message_objects (your current evaluator inputs)
 *  - inputs.messages (LangChain-style message list)
 *  - inputs.input / inputs.prompt as a final fallback
 */
function extractConversationFromRun(run: Run): {
  allMessages: string;
  allMessageObjects: SimpleMessage[];
} {
  const allMessageObjects: SimpleMessage[] = [];

  const inputs = (run.inputs || {}) as any;

  if (Array.isArray(inputs.all_message_objects) && inputs.all_message_objects.length) {
    for (const m of inputs.all_message_objects) {
      if (!m) continue;
      const role = normaliseRole(m.role);
      const content = String(m.content ?? "").trim();
      if (content) {
        allMessageObjects.push({ role, content });
      }
    }
  } else if (Array.isArray(inputs.messages)) {
    for (const m of inputs.messages) {
      if (!m) continue;
      // LangChain messages may be { type, data: { content } } or { role, content }
      const role = normaliseRole(m.role ?? m.type ?? m.data?.role);
      const content = String(
        m.content ?? m.data?.content ?? m.text ?? "",
      ).trim();
      if (content) {
        allMessageObjects.push({ role, content });
      }
    }
  } else if (typeof inputs.input === "string" && inputs.input.trim()) {
    allMessageObjects.push({
      role: "user",
      content: inputs.input.trim(),
    });
  }

  const allMessages = allMessageObjects
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return {
    allMessages,
    allMessageObjects,
  };
}

const systemPrompt = `
You are an expert evaluator for AI-powered life coaching conversations.
You will be given a full multi-turn conversation between a user and their AI life coach.

Your job is to score the conversation across 5 dimensions (0-5 or null) and 3 conversation-level checks (pass/fail),
matching this JSON schema exactly:

{
  "emotional_support_score": number | null,
  "emotional_support_pass": boolean | "N/A",
  "emotional_support_reason": string,

  "actionability_score": number | null,
  "actionability_pass": boolean | "N/A",
  "actionability_reason": string,

  "decisioning_tool_usage_score": number | null,
  "decisioning_tool_usage_pass": boolean | "N/A",
  "decisioning_tool_usage_reason": string,

  "progress_measurement_score": number | null,
  "progress_measurement_pass": boolean | "N/A",
  "progress_measurement_reason": string,

  "accountability_score": number | null,
  "accountability_pass": boolean | "N/A",
  "accountability_reason": string,

  "conversation_flow_pass": boolean,
  "conversation_flow_reason": string,

  "outcome_pass": boolean,
  "outcome_reason": string,

  "final_pass": boolean,
  "final_reason": string
}

Scoring guidelines:
- Scores are 0-5 where 5 is excellent and 0 is a hard fail.
- Use null when the dimension is clearly not applicable to this conversation.
- Use "N/A" for the *_pass fields when the dimension is not applicable.
- final_pass should be true only if the agent overall met the user's needs.
Return ONLY JSON, no extra text.`;

/**
 * LLM-as-judge evaluator that mirrors the existing Comprehensive judge rubric.
 */
const comprehensiveJudge = runEvaluator(
  async (run: Run): Promise<EvaluationResult> => {
    const { allMessages, allMessageObjects } = extractConversationFromRun(run);

    const conversationBlock =
      allMessages && allMessages.trim().length > 0
        ? allMessages
        : "(No messages were found in this run's inputs.)";

    const userPrompt = `
Here is a full conversation between a user and an AI life coach.
Each line is prefixed by the speaker role.

CONVERSATION (TEXT):
--------------------
${conversationBlock}

CONVERSATION (STRUCTURED):
--------------------------
${JSON.stringify(allMessageObjects, null, 2)}

Now, evaluate this conversation according to the rubric in the system message.
Respond with a single JSON object matching the exact schema described there.`;

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
        ? response.content.map((c: any) => c?.text ?? c).join("\n")
        : String(response.content);

    // Strip markdown fences if present and parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        "Comprehensive judge evaluator: failed to extract JSON from model output",
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const finalPass = Boolean(parsed.final_pass);
    const finalReason = String(parsed.final_reason ?? "").trim();

    const result: EvaluationResult = {
      key: "comprehensive_judge",
      score: finalPass ? 1 : 0,
      value: parsed,
      comment:
        finalReason ||
        "Comprehensive judge evaluation completed (see value payload for details).",
      evaluatorInfo: {
        evaluatorType: "llm_as_judge",
        project: PROJECT_NAME,
      },
    };

    return result;
  },
);

interface CliOptions {
  runId?: string;
  count?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];

    switch (flag) {
      case "--run-id":
        options.runId = value;
        i++;
        break;
      case "--count":
        options.count = Number(value);
        i++;
        break;
    }
  }

  return options;
}

async function evaluateSingleRun(client: Client, runId: string) {
  console.log(`🔍 Evaluating run ${runId} in project ${PROJECT_NAME}...`);
  const feedback = await client.evaluateRun(runId, comprehensiveJudge, {
    loadChildRuns: true,
    sourceInfo: {
      evaluatorName: "Comprehensive judge evaluator (SDK)",
      project: PROJECT_NAME,
    },
  });
  console.log(
    `✅ Evaluation complete. Feedback key="${feedback.key}", score=${feedback.score}`,
  );
}

async function evaluateRecentRuns(client: Client, count: number) {
  console.log(
    `🔍 Fetching last ${count} root runs from project ${PROJECT_NAME}...`,
  );

  const runs: Run[] = [];
  for await (const run of client.listRuns({
    projectName: PROJECT_NAME,
    isRoot: true,
    order: "desc",
    limit: count,
  })) {
    runs.push(run);
  }

  if (runs.length === 0) {
    console.log("No runs found to evaluate.");
    return;
  }

  console.log(`✅ Found ${runs.length} runs. Running evaluations...`);

  let completed = 0;
  for (const run of runs) {
    completed += 1;
    try {
      const feedback = await client.evaluateRun(run, comprehensiveJudge, {
        loadChildRuns: true,
        sourceInfo: {
          evaluatorName: "Comprehensive judge evaluator (SDK)",
          project: PROJECT_NAME,
        },
      });
      console.log(
        `  • [${completed}/${runs.length}] Run ${run.id} -> key="${feedback.key}", score=${feedback.score}`,
      );
    } catch (error) {
      console.error(
        `  ⚠️  Failed to evaluate run ${run.id}:`,
        (error as Error).message,
      );
    }
  }

  console.log("🎉 Completed evaluations for recent runs.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = new Client();

  if (options.runId) {
    await evaluateSingleRun(client, options.runId);
  } else {
    const count = options.count ?? 50;
    await evaluateRecentRuns(client, count);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Comprehensive evaluator failed:", error);
    process.exit(1);
  });
}


