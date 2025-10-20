import { AgentContext, AgentResponse, AgentType } from "./types";
import { MasterAgent } from "./masterAgent";
import { SuggestGoalsAgent } from "./suggestGoalsAgent";
import { ReviewProgressAgent } from "./reviewProgressAgent";
import { PrioritizeOptimizeAgent } from "./prioritizeOptimizeAgent";
import { SurpriseMeAgent } from "./surpriseMeAgent";

export class AgentRouter {
  private masterAgent: MasterAgent;
  private suggestGoalsAgent: SuggestGoalsAgent;
  private reviewProgressAgent: ReviewProgressAgent;
  private prioritizeOptimizeAgent: PrioritizeOptimizeAgent;
  private surpriseMeAgent: SurpriseMeAgent;

  constructor() {
    this.masterAgent = new MasterAgent();
    this.suggestGoalsAgent = new SuggestGoalsAgent();
    this.reviewProgressAgent = new ReviewProgressAgent();
    this.prioritizeOptimizeAgent = new PrioritizeOptimizeAgent();
    this.surpriseMeAgent = new SurpriseMeAgent();
  }

  async processMessage(context: AgentContext, requestedAgentType?: AgentType): Promise<AgentResponse> {
    const { userMessage } = context;

    // If a specific agent is requested, use it directly
    if (requestedAgentType && requestedAgentType !== 'master') {
      return this.routeToAgent(requestedAgentType, context);
    }

    // Otherwise, let the master agent determine the best approach
    const masterResponse = await this.masterAgent.processMessage(context);
    
    // If the master agent suggests a special agent, route to it
    if (masterResponse.agentType && masterResponse.agentType !== 'master') {
      console.log(`[AgentRouter] Master agent suggests switching to: ${masterResponse.agentType}`);
      
      // Get the special agent response
      const specialAgentResponse = await this.routeToAgent(masterResponse.agentType, context);
      
      // Return only the special agent's response, not concatenated
      return {
        finalText: specialAgentResponse.finalText,
        structuredData: specialAgentResponse.structuredData,
        cta: specialAgentResponse.cta,
      };
    }

    return masterResponse;
  }

  private async routeToAgent(agentType: AgentType, context: AgentContext): Promise<AgentResponse> {
    console.log(`[AgentRouter] Routing to agent: ${agentType}`);

    switch (agentType) {
      case 'suggest_goals':
        return await this.suggestGoalsAgent.processMessage(context);
      
      case 'review_progress':
        return await this.reviewProgressAgent.processMessage(context);
      
      case 'prioritize_optimize':
        return await this.prioritizeOptimizeAgent.processMessage(context);
      
      case 'surprise_me':
        return await this.surpriseMeAgent.processMessage(context);
      
      case 'master':
      default:
        return await this.masterAgent.processMessage(context);
    }
  }

  // Helper method to determine agent type from user message
  static determineAgentTypeFromMessage(userMessage: string): AgentType | undefined {
    const message = userMessage.toLowerCase();

    if (message.includes('review') || message.includes('progress') || message.includes('habits') || message.includes('complete')) {
      return 'review_progress';
    }
    if (message.includes('suggest') || message.includes('goal') || message.includes('new goal') || message.includes('aspiration')) {
      return 'suggest_goals';
    }
    if (message.includes('prioritize') || message.includes('optimize') || message.includes('focus') || message.includes('overwhelm')) {
      return 'prioritize_optimize';
    }
    if (message.includes('surprise') || message.includes('insight') || message.includes('pattern') || message.includes('unexpected')) {
      return 'surprise_me';
    }

    return undefined;
  }
}
