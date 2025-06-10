// services/agents/base/Agent.ts
import { 
  IntentType, 
  AgentMessage, 
  BaseAgentResponse as AgentResponse
} from '@/lib/types';
import { FurnitureKnowledgeGraph } from '@/services/knowledge/FurnitureKnowledgeGraph';

export interface AgentContext {
  getCurrentDesign: () => any;
  fromAgent?: string;
  sharedState?: any;
}

export abstract class Agent {
  abstract name: string;
  protected knowledgeGraph: FurnitureKnowledgeGraph;
  protected interestedEvents: string[] = [];
  
  // Injected by communication bus
  protected query?: (targetAgent: string, query: any, options?: any) => Promise<any>;
  protected broadcast?: (eventType: string, data: any) => Promise<void>;
  protected requestValidation?: (design: any) => Promise<Map<string, any>>;

  constructor(knowledgeGraph: FurnitureKnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph;
  }

  abstract canHandle(intent: IntentType): boolean;
  
  abstract process(
    input: string, 
    context: AgentContext
  ): Promise<AgentResponse>;

  async handleMessage?(message: AgentMessage): Promise<any> {
    // Default implementation
    if (message.type === 'query') {
      return this.process(
        JSON.stringify(message.payload),
        { 
          getCurrentDesign: () => ({}),
          fromAgent: message.from_agent 
        }
      );
    }
    return null;
  }

  getInterestedEvents(): string[] {
    return this.interestedEvents;
  }

  protected createSuccessResponse(
    data: any,
    extras: Partial<AgentResponse> = {}
  ): AgentResponse {
    return {
      success: true,
      data,
      suggestions: [],
      validation_issues: [],
      next_steps: [],
      confidence: 0.9,
      ...extras
    };
  }

  protected createErrorResponse(
    error: string,
    suggestions: string[] = []
  ): AgentResponse {
    return {
      success: false,
      data: null,
      validation_issues: [error],
      suggestions,
      next_steps: [],
      confidence: 0
    };
  }
}