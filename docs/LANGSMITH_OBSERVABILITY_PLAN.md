# LangSmith Observability & Evaluation Implementation Plan

## Overview
This plan outlines the implementation of LangSmith observability, tracing, and evaluation for the Intention Growth Hub agent system.

**Start Date:** TBD  
**Target Completion:** 5 weeks  
**Status:** Not Started

---

## Phase 1: LangSmith Setup & Configuration ⚙️

### 1.1 Install LangSmith SDK
- [x] Run `npm install langsmith`
- [x] Verify installation in `package.json`

### 1.2 Environment Configuration
- [x] Create LangSmith account at https://smith.langchain.com
- [x] Generate API key from LangSmith dashboard
- [x] Add environment variables to `.env`:
  ```env
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_API_KEY=<your-langsmith-api-key>
  LANGCHAIN_PROJECT=intention-growth-hub-dev
  LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
  ```
- [ ] Add to `.env.production`:
  ```env
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_API_KEY=<your-prod-api-key>
  LANGCHAIN_PROJECT=intention-growth-hub-prod
  LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
  ```
- [ ] Update `.gitignore` to ensure `.env` is not committed

### 1.3 Create Environment-Specific Projects
- [ ] Create `intention-growth-hub-dev` project in LangSmith
- [ ] Create `intention-growth-hub-prod` project in LangSmith
- [ ] Create `intention-growth-hub-evals` project in LangSmith
- [ ] Set up team workspace and invite collaborators

**Target:** Week 1  
**Status:** ⏸️ Not Started

---

## Phase 2: Tracing Integration 🔍

### 2.1 Enable Automatic Tracing
- [x] Verify LangChain automatically traces with env vars set
- [x] Test basic tracing with a simple agent call
- [x] Verify traces appear in LangSmith dashboard

### 2.2 Add Custom Trace Metadata
Files to modify:
- [ ] `server/ai/lifeCoachService.ts` - Main chat entry point
- [x] `server/ai/singleAgent.ts` - Tool agent execution
- [ ] `server/ai/agent.ts` - InsightAgent journal processing
- [ ] `server/ai/agents/masterAgent.ts`
- [ ] `server/ai/agents/suggestGoalsAgent.ts`
- [ ] `server/ai/agents/reviewProgressAgent.ts`
- [ ] `server/ai/agents/prioritizeOptimizeAgent.ts`
- [ ] `server/ai/agents/surpriseMeAgent.ts`

### 2.3 Implement Tagging Strategy
- [x] Add `agent_type` tag (tool_agent, insight_agent, master_agent, etc.)
- [x] Add `user_id` tag for per-user pattern tracking (via metadata)
- [x] Add `thread_id` tag for conversation grouping (via metadata)
- [x] Add `mode` tag (plan_ahead, review_progress, prioritize, etc.)
- [x] Add `tool_used` tag for tool call tracking
- [x] Add `environment` tag (dev, staging, prod)
- [x] Create tagging utility function (`server/ai/utils/langsmithTracing.ts`)

### 2.4 Track Custom Metrics
- [ ] Tool selection accuracy
- [ ] Response latency
- [ ] Token usage per agent type
- [ ] Tool call success/failure rates
- [ ] User satisfaction signals
- [ ] Create metrics dashboard in LangSmith

**Target:** Week 1-2  
**Status:** ✅ Complete (Ready for Phase 7.1: Trace Analysis)

---

## Phase 3: Structured Logging for Tool Calls 📊

### 3.1 Enhance Tool Call Logging
- [ ] Enhance `handleLLMEnd` callback in `singleAgent.ts`
- [ ] Enhance `handleToolStart` callback
- [ ] Enhance `handleToolEnd` callback
- [ ] Enhance `handleToolError` callback
- [ ] Add structured metadata to all callbacks
- [ ] Create tool call performance tracker

### 3.2 Create Tool Performance Dashboard
Track in LangSmith:
- [ ] Most frequently called tools
- [ ] Tool success rates
- [ ] Tools leading to user satisfaction
- [ ] Tool call latency distribution
- [ ] Tool error patterns

**Target:** Week 2  
**Status:** ⏸️ Not Started

---

## Phase 4: Feedback Collection 💬

### 4.1 User Feedback Integration

**Explicit feedback:**
- [ ] Add thumbs up/down UI component
- [ ] Add 1-5 star rating component
- [ ] Add "Mark as helpful/unhelpful" button
- [ ] Create feedback API endpoint

**Implicit feedback:**
- [ ] Track goal/habit acceptance rate
- [ ] Track habit completion rates after suggestion
- [ ] Track tool usage patterns (card engagement)
- [ ] Track conversation continuation vs abandonment

### 4.2 Implement Feedback API
- [ ] Create `server/services/feedbackService.ts`
- [ ] Implement `submitFeedback()` function
- [ ] Add LangSmith client integration
- [ ] Create feedback submission endpoint (`POST /api/feedback`)
- [ ] Test feedback submission

### 4.3 Store Run IDs for Feedback
- [ ] Modify `streamLifeCoachReply()` to return `runId`
- [ ] Modify `processWithToolAgent()` to return `runId`
- [ ] Update chat API response to include `runId`
- [ ] Update frontend to store `runId` with messages
- [ ] Link feedback UI to `runId`

**Target:** Week 3  
**Status:** ⏸️ Not Started

---

## Phase 5: Evaluation Datasets 📝

### 5.1 Create Test Datasets

**A. Export historical conversations:**
- [ ] Identify high-quality user interactions
- [ ] Export conversations with positive outcomes
- [ ] Export edge cases (overwhelm, adjustments, etc.)
- [ ] Format as evaluation dataset

**B. Create synthetic test cases:**
- [ ] User plans the week
- [ ] User reports progress on goals
- [ ] User feels overwhelmed
- [ ] User wants to adjust a goal
- [ ] User asks for habit suggestions
- [ ] User asks for progress review
- [ ] User sets multiple new goals
- [ ] User completes a goal

### 5.2 Dataset Structure
- [ ] Define dataset schema
- [ ] Create `evals/datasets/test-cases.json`
- [ ] Include expected inputs and outputs
- [ ] Include expected tool calls
- [ ] Include expected response characteristics

### 5.3 Upload to LangSmith
- [ ] Create dataset upload script
- [ ] Upload to LangSmith "intention-growth-hub-test-cases"
- [ ] Verify dataset in LangSmith dashboard
- [ ] Create versioning strategy for datasets

**Target:** Week 3  
**Status:** ⏸️ Not Started

---

## Phase 6: Evaluation Framework ✅

### 6.1 Define Evaluation Metrics

**Automatic evaluators:**
- [ ] Coherence: Is response coherent and on-topic?
- [ ] Conciseness: Follows 2-4 sentence guideline?
- [ ] Tool usage accuracy: Called right tools?
- [ ] No hallucinations: Avoids mentioning non-existent goals?
- [ ] CTA presence: Includes appropriate CTAs?
- [ ] Response latency: Under 3s p95?

**Human evaluators:**
- [ ] Helpfulness score
- [ ] Empathy score
- [ ] Actionability score

### 6.2 Create Custom Evaluators
- [ ] Create `evals/evaluators/` directory
- [ ] Implement `evaluateToolSelection.ts`
- [ ] Implement `evaluateNoHallucination.ts`
- [ ] Implement `evaluateEmpathy.ts` (LLM-as-judge)
- [ ] Implement `evaluateConciseness.ts`
- [ ] Implement `evaluateCoherence.ts`
- [ ] Implement `evaluateCTA.ts`
- [ ] Create evaluator registry

### 6.3 Run Evaluations
- [ ] Create `evals/runner.ts`
- [ ] Implement evaluation runner
- [ ] Test on small dataset
- [ ] Run full evaluation suite
- [ ] Generate evaluation report

**Target:** Week 4  
**Status:** ⏸️ Not Started

---

## Phase 7: Prompt Optimization Workflow 🔧

### 7.1 Baseline Metrics - **CURRENT FOCUS**
- [x] Run initial eval on `LIFE_COACH_PROMPT` (singleAgent.ts) - **Using LangSmith traces for analysis**
- [x] Document baseline scores - **Identified: tool descriptions need improvement, prompt needs better tool calling guidance**
- [x] Identify areas for improvement - **Tool call accuracy, making assumptions when needed**
- [ ] **DO THIS NOW:** Trace analysis session - analyze 20-30 recent traces (see `TRACE_ANALYSIS_GUIDE.md`)
- [ ] **DO THIS NOW:** Create prioritized improvement list based on trace findings
- [ ] Run initial eval on `TEMPLATE` (agent.ts - InsightAgent) - Later
- [ ] Run initial eval on individual agent prompts - Later

### 7.2 A/B Testing Framework
- [ ] Create prompt variant system
- [ ] Implement deterministic variant selection by userId
- [ ] Create variant routing logic
- [ ] Tag runs with prompt variant
- [ ] Create variant comparison dashboard

### 7.3 Iterate on Prompts
- [ ] Identify low-scoring areas from evals
- [ ] Create prompt variants addressing issues
- [ ] Run evaluations on variants
- [ ] Compare metrics between variants
- [ ] Deploy winning variant

### 7.4 Monitor Production Performance
- [ ] Set up production monitoring dashboard
- [ ] Track user satisfaction (feedback scores)
- [ ] Track goal/habit acceptance rates
- [ ] Track tool call accuracy
- [ ] Track response quality (LLM-as-judge on sample)
- [ ] Set up alerting for degradation

**Target:** Week 4-5  
**Status:** ⏸️ Not Started

---

## Phase 8: Continuous Improvement 🔄

### 8.1 Weekly Eval Runs
- [ ] Create cron job for weekly evaluations
- [ ] Create evaluation report template
- [ ] Set up Slack/email notifications
- [ ] Schedule: Every Monday at 9am

### 8.2 Regression Testing
- [ ] Create pre-deployment checklist
- [ ] Run full eval suite before deployment
- [ ] Check for regressions on existing test cases
- [ ] Verify new test cases pass
- [ ] Document regression policy

### 8.3 Dataset Expansion
- [ ] Process for adding edge cases from production
- [ ] Process for adding user-reported issues
- [ ] Process for adding new feature test cases
- [ ] Monthly dataset review and cleanup

### 8.4 LangSmith Dashboards
- [ ] Create "Agent Performance" dashboard (latency, tokens, tool calls)
- [ ] Create "User Satisfaction" dashboard (feedback, acceptance rates)
- [ ] Create "Error Tracking" dashboard (failed tools, exceptions)
- [ ] Create "Prompt Comparison" dashboard (variant performance)
- [ ] Share dashboards with team

**Target:** Week 5+  
**Status:** ⏸️ Not Started

---

## Key Success Metrics

Track these to measure improvement:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| User satisfaction score (explicit feedback) | - | >4.0/5.0 | 📊 TBD |
| Goal acceptance rate | - | >60% | 📊 TBD |
| Habit completion rate (7-day streak) | - | >40% | 📊 TBD |
| Tool call accuracy | - | >90% | 📊 TBD |
| Hallucination rate | - | <5% | 📊 TBD |
| Response latency (p95) | - | <3s | 📊 TBD |
| Error rate | - | <1% | 📊 TBD |

---

## Implementation Schedule

| Week | Phase | Tasks | Owner | Status |
|------|-------|-------|-------|--------|
| 1 | Phase 1 & 2.1-2.2 | Install LangSmith, configure env, enable basic tracing | - | ⏸️ |
| 2 | Phase 2.3-2.4 & 3 | Tagging strategy, custom metrics, tool logging | - | ⏸️ |
| 3 | Phase 4 & 5 | Feedback collection, create datasets | - | ⏸️ |
| 4 | Phase 6 & 7.1 | Evaluation framework, baseline metrics | - | ⏸️ |
| 5+ | Phase 7.2-7.4 & 8 | A/B testing, optimization, automation | - | ⏸️ |

---

## Team Collaboration Setup

### LangSmith Workspace
- [ ] Create LangSmith organization workspace
- [ ] Invite team members
- [ ] Set up role-based access
- [ ] Share API keys securely (via 1Password/Vault)

### Development Workflow
- [ ] Document how to enable/disable tracing in development
- [ ] Create dev guidelines for adding new evaluators
- [ ] Document prompt modification workflow
- [ ] Set up code review process for prompt changes

---

## Cost Management

- [ ] Implement trace sampling (10% for non-critical paths)
- [ ] Use gpt-4o-mini for evaluators
- [ ] Set up trace retention policy (90 days)
- [ ] Monitor monthly LangSmith costs
- [ ] Set up cost alerts

---

## Security & Privacy

- [ ] Ensure PII is scrubbed before sending to LangSmith (use existing SecurityManager)
- [ ] Use separate API keys for dev/prod
- [ ] Document data retention policies
- [ ] Review LangSmith data processing agreement
- [ ] Implement row-level security if needed

---

## Notes & Decisions

### Decision Log
| Date | Decision | Rationale |
|------|----------|-----------|
| - | - | - |

### Blockers & Issues
| Date | Issue | Resolution | Status |
|------|-------|------------|--------|
| - | - | - | - |

### Learning & Insights
| Date | Insight | Action Items |
|------|---------|--------------|
| Initial Setup | Traces are working well. Can see tool calls clearly. Identified areas for improvement: | - Improve tool descriptions for better tool calling accuracy<br>- Enhance prompts to be better at tool selection<br>- Train agent to make reasonable assumptions when needed<br>- Use LangSmith trace analysis to identify patterns in tool call failures |

---

## Resources

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [LangChain Tracing Guide](https://python.langchain.com/docs/langsmith/walkthrough)
- [LangSmith Evaluation Guide](https://docs.smith.langchain.com/evaluation)
- [LangSmith API Reference](https://api.smith.langchain.com/docs)

---

## Status Key
- ⏸️ Not Started
- 🔄 In Progress
- ✅ Complete
- ⚠️ Blocked
- ❌ Cancelled

