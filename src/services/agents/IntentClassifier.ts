// intent-classifier.ts
import { z } from 'zod';
import { openAIService, IntentClassificationSchema } from '@/services/api/openai';
import { PROMPTS, formatPrompt } from '@/lib/prompts';
import { 
  IntentType,
  BaseAgentResponse as AgentResponse,
  AgentMessage
} from '@/lib/types';

// Import the IntentResult type from OpenAI schema
export type IntentResult = z.infer<typeof IntentClassificationSchema>;

// Design Context Manager
export class DesignContext {
  private history: Array<{
    input: string;
    intent: IntentResult;
    agentResponses: Map<string, any>;
    timestamp: Date;
  }> = [];
  
  private currentDesign: {
    furniture_type?: string;
    dimensions: Map<string, number>;
    materials: string[];
    joinery: string[];
    style?: string;
    constraints: string[];
    validation_status?: 'pending' | 'valid' | 'invalid';
  } = {
    dimensions: new Map(),
    materials: [],
    joinery: [],
    constraints: []
  };

  addInteraction(input: string, intent: IntentResult, responses: Map<string, any> = new Map()) {
    this.history.push({
      input,
      intent,
      agentResponses: responses,
      timestamp: new Date()
    });
    this.updateCurrentDesign(intent);
  }

  private updateCurrentDesign(intent: IntentResult) {
    if (intent.entities.furniture_type) {
      this.currentDesign.furniture_type = intent.entities.furniture_type;
    }
    if (intent.entities.dimensions) {
      intent.entities.dimensions.forEach(dim => {
        this.currentDesign.dimensions.set(dim.type, dim.value);
      });
    }
    if (intent.entities.materials) {
      this.currentDesign.materials.push(...intent.entities.materials);
    }
    if (intent.entities.style) {
      this.currentDesign.style = intent.entities.style;
    }
    if (intent.entities.constraints) {
      this.currentDesign.constraints.push(...intent.entities.constraints);
    }
  }

  getContext() {
    return {
      history: this.history.slice(-5), // Last 5 interactions
      currentDesign: this.currentDesign,
      isDesignComplete: this.checkDesignCompleteness()
    };
  }

  private checkDesignCompleteness(): boolean {
    return !!(
      this.currentDesign.furniture_type &&
      this.currentDesign.dimensions.size > 0 &&
      this.currentDesign.materials.length > 0
    );
  }

  // Get formatted context for LLM
  getFormattedContext(): string {
    const context = this.getContext();
    return JSON.stringify(context.currentDesign, null, 2);
  }

  // Get conversation history for LLM
  getConversationHistory(): string {
    return this.history
      .slice(-5)
      .map(h => `User: ${h.input}\nIntent: ${h.intent.primary_intent}`)
      .join('\n\n');
  }
}

// Intent Classifier
export class IntentClassifier {
  private context: DesignContext;
  private costTracker = {
    totalCalls: 0,
    totalCost: 0,
    avgResponseTime: 0
  };

  constructor() {
    this.context = new DesignContext();
  }

  async classifyIntent(userInput: string): Promise<IntentResult> {
    const startTime = Date.now();
    
    try {
      // Format the prompt with context
      const prompt = formatPrompt(PROMPTS.INTENT_CLASSIFICATION_PROMPT, {
        context: this.context.getFormattedContext(),
        input: userInput,
        format_instructions: 'Return a valid JSON object matching the specified schema.'
      });

      // Make LLM call with structured output
      const response = await openAIService.structuredCall(
        prompt,
        IntentClassificationSchema,
        {
          model: 'gpt-3.5-turbo-1106', // Fast and cost-effective for classification
          temperature: 0.1, // Low temperature for consistency
          maxTokens: 500
        }
      );

      // Track costs
      this.costTracker.totalCalls++;
      this.costTracker.totalCost += response.usage.estimatedCost;
      this.costTracker.avgResponseTime = 
        (this.costTracker.avgResponseTime * (this.costTracker.totalCalls - 1) + response.duration) / 
        this.costTracker.totalCalls;

      // Enhance classification with furniture-specific logic
      const enhancedResult = this.enhanceClassification(response.data, userInput);

      console.log('Intent classified:', {
        intent: enhancedResult.primary_intent,
        confidence: enhancedResult.confidence,
        cost: response.usage.estimatedCost,
        duration: response.duration
      });

      return enhancedResult;

    } catch (error) {
      console.error('Classification error:', error);
      
      // Fall back to rule-based classification
      return this.fallbackClassification(userInput);
    }
  }

  private enhanceClassification(result: IntentResult, input: string): IntentResult {
    const contextData = this.context.getContext();
    
    // Add furniture-specific enhancements
    
    // If dimension specified without furniture type, add clarification
    if (result.primary_intent === IntentType.DIMENSION_SPECIFICATION && 
        !contextData.currentDesign.furniture_type) {
      result.requires_clarification = true;
      result.clarification_prompts = [
        "What type of furniture are you building?",
        "Is this for a table, shelf, chair, or something else?"
      ];
    }

    // If material selected, suggest joinery as next step
    if (result.primary_intent === IntentType.MATERIAL_SELECTION &&
        !contextData.currentDesign.joinery.length) {
      result.suggested_next_intents = [IntentType.JOINERY_METHOD];
    }

    // Auto-suggest validation after major modifications
    if (result.primary_intent === IntentType.MODIFICATION_REQUEST) {
      result.suggested_next_intents = [IntentType.VALIDATION_CHECK];
    }

    // If design is complete but not validated, suggest validation
    if (contextData.isDesignComplete && 
        contextData.currentDesign.validation_status !== 'valid') {
      if (!result.suggested_next_intents.includes(IntentType.VALIDATION_CHECK)) {
        result.suggested_next_intents.push(IntentType.VALIDATION_CHECK);
      }
    }

    return result;
  }

  private fallbackClassification(input: string): IntentResult {
    // Enhanced fallback with better pattern matching
    const lower = input.toLowerCase();
    
    let primary_intent = IntentType.CLARIFICATION_NEEDED;
    const entities: any = {};
    
    // Furniture type detection
    const furnitureTypes = ['table', 'chair', 'bookshelf', 'shelf', 'cabinet', 
                           'desk', 'nightstand', 'dresser', 'bench'];
    for (const type of furnitureTypes) {
      if (lower.includes(type)) {
        primary_intent = IntentType.DESIGN_INITIATION;
        entities.furniture_type = type;
        break;
      }
    }
    
    // Dimension detection
    if (lower.match(/\d+\s*(inch|inches|foot|feet|cm|mm|"|')/)) {
      primary_intent = IntentType.DIMENSION_SPECIFICATION;
      
      // Extract dimensions
      const dimensionRegex = /(\d+(?:\.\d+)?)\s*(inch|inches|foot|feet|cm|mm|"|')/gi;
      const dimensions = [];
      let match;
      
      while ((match = dimensionRegex.exec(input)) !== null) {
        dimensions.push({
          type: 'unknown',
          value: parseFloat(match[1]),
          unit: match[2]
        });
      }
      
      if (dimensions.length > 0) {
        entities.dimensions = dimensions;
      }
    }
    
    // Material detection
    const materials = ['pine', 'oak', 'maple', 'walnut', 'plywood', 'mdf'];
    for (const material of materials) {
      if (lower.includes(material)) {
        primary_intent = IntentType.MATERIAL_SELECTION;
        entities.materials = [material];
        break;
      }
    }

    // Joinery detection
    if (lower.includes('joint') || lower.includes('join') || 
        lower.includes('connect') || lower.includes('attach')) {
      primary_intent = IntentType.JOINERY_METHOD;
    }

    // Validation request
    if (lower.includes('check') || lower.includes('validate') || 
        lower.includes('verify') || lower.includes('strong enough')) {
      primary_intent = IntentType.VALIDATION_CHECK;
    }

    // Export request
    if (lower.includes('download') || lower.includes('export') || 
        lower.includes('pdf') || lower.includes('save')) {
      primary_intent = IntentType.EXPORT_REQUEST;
    }

    return {
      primary_intent,
      secondary_intents: [],
      confidence: Confidence.LOW,
      entities,
      requires_clarification: primary_intent === IntentType.CLARIFICATION_NEEDED,
      clarification_prompts: 
        primary_intent === IntentType.CLARIFICATION_NEEDED ?
        ["Could you tell me more about what you'd like to build?",
         "What type of furniture are you interested in designing?"] : [],
      suggested_next_intents: this.suggestNextIntents(primary_intent)
    };
  }

  private suggestNextIntents(currentIntent: IntentType): string[] {
    const workflow = {
      [IntentType.DESIGN_INITIATION]: [IntentType.DIMENSION_SPECIFICATION],
      [IntentType.DIMENSION_SPECIFICATION]: [IntentType.MATERIAL_SELECTION],
      [IntentType.MATERIAL_SELECTION]: [IntentType.JOINERY_METHOD],
      [IntentType.JOINERY_METHOD]: [IntentType.VALIDATION_CHECK],
      [IntentType.VALIDATION_CHECK]: [IntentType.EXPORT_REQUEST],
      [IntentType.MODIFICATION_REQUEST]: [IntentType.VALIDATION_CHECK],
      [IntentType.STYLE_AESTHETIC]: [IntentType.MATERIAL_SELECTION],
      [IntentType.CONSTRAINT_SPECIFICATION]: [IntentType.VALIDATION_CHECK]
    };

    return workflow[currentIntent] || [IntentType.DESIGN_INITIATION];
  }

  getContext(): DesignContext {
    return this.context;
  }

  getCostReport() {
    return {
      ...this.costTracker,
      avgCostPerCall: this.costTracker.totalCost / Math.max(1, this.costTracker.totalCalls)
    };
  }

  resetContext() {
    this.context = new DesignContext();
  }
}

// Agent Interface
export interface Agent {
  name: string;
  process(input: string, context: DesignContext | any): Promise<AgentResponse>;
  canHandle(intent: IntentType): boolean;
  handleMessage?: (message: AgentMessage) => Promise<any>;
  interestedEvents?: string[];
}

// Agent Orchestrator
export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private classifier: IntentClassifier;
  
  constructor(classifier: IntentClassifier) {
    this.classifier = classifier;
  }

  registerAgent(agent: Agent) {
    this.agents.set(agent.name, agent);
  }

  async processUserInput(input: string): Promise<OrchestrationResult> {
    // Step 1: Classify intent
    const intentResult = await this.classifier.classifyIntent(input);
    
    // Step 2: Route to appropriate agents
    const agentResponses = new Map<string, AgentResponse>();
    
    // Process primary intent
    const primaryAgent = this.findAgentForIntent(intentResult.primary_intent);
    if (primaryAgent) {
      const response = await primaryAgent.process(
        input, 
        this.classifier.getContext()
      );
      agentResponses.set(primaryAgent.name, response);
    }
    
    // Process secondary intents in parallel
    const secondaryPromises = intentResult.secondary_intents.map(async (intent) => {
      const agent = this.findAgentForIntent(intent as IntentType);
      if (agent) {
        const response = await agent.process(
          input,
          this.classifier.getContext()
        );
        return { name: agent.name, response };
      }
      return null;
    });
    
    const secondaryResults = await Promise.all(secondaryPromises);
    secondaryResults.forEach(result => {
      if (result) {
        agentResponses.set(result.name, result.response);
      }
    });
    
    // Step 3: Update context
    this.classifier.getContext().addInteraction(input, intentResult, agentResponses);
    
    // Step 4: Generate unified response
    return this.generateUnifiedResponse(intentResult, agentResponses);
  }

  private findAgentForIntent(intent: IntentType): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(intent)) {
        return agent;
      }
    }
    return undefined;
  }

  private generateUnifiedResponse(
    intent: IntentResult,
    responses: Map<string, AgentResponse>
  ): OrchestrationResult {
    const allSuggestions: string[] = [];
    const allValidationIssues: string[] = [];
    const allNextSteps: string[] = [];
    let primaryData: any = {};

    responses.forEach((response, agentName) => {
      if (response.suggestions) allSuggestions.push(...response.suggestions);
      if (response.validation_issues) allValidationIssues.push(...response.validation_issues);
      if (response.next_steps) allNextSteps.push(...response.next_steps);
      
      // Merge data from primary agent
      if (agentName === this.findAgentForIntent(intent.primary_intent)?.name) {
        primaryData = response.data;
      }
    });

    return {
      intent,
      primaryData,
      suggestions: [...new Set(allSuggestions)],
      validationIssues: [...new Set(allValidationIssues)],
      nextSteps: [...new Set(allNextSteps)],
      requiresClarification: intent.requires_clarification,
      clarificationPrompts: intent.clarification_prompts,
      context: this.classifier.getContext().getContext()
    };
  }
}

export interface OrchestrationResult {
  intent: IntentResult;
  primaryData: any;
  suggestions: string[];
  validationIssues: string[];
  nextSteps: string[];
  requiresClarification: boolean;
  clarificationPrompts?: string[];
  context: any;
}