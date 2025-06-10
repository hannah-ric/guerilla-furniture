import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface LLMResponse<T = any> {
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  duration: number;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (response: any) => void;
  onError?: (error: Error) => void;
}

/**
 * OpenAI API service with streaming, structured outputs, and cost tracking
 */
export class OpenAIService {
  private client: OpenAI;
  private defaultConfig: LLMConfig = {
    model: 'gpt-3.5-turbo-1106',
    temperature: 0.1,
    maxTokens: 1000
  };
  
  // Cost per 1K tokens (as of 2024)
  private costPerThousand = {
    'gpt-3.5-turbo-1106': { input: 0.001, output: 0.002 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 }
  };

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // For MVP - move to backend in production
    });
  }

  /**
   * Make a structured LLM call with Zod schema validation
   */
  async structuredCall<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    config: Partial<LLMConfig> = {}
  ): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    try {
      const completion = await this.client.chat.completions.create({
        model: mergedConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a furniture design expert AI assistant. Always provide accurate, practical advice.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        response_format: zodResponseFormat(schema, 'furniture_response')
      });

      const response = completion.choices[0].message;
      const usage = completion.usage!;
      
      // Parse the response
      const parsedData = JSON.parse(response.content!);
      const validatedData = schema.parse(parsedData);
      
      return {
        data: validatedData,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCost: this.calculateCost(
            mergedConfig.model,
            usage.prompt_tokens,
            usage.completion_tokens
          )
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Make a streaming LLM call
   */
  async streamingCall(
    prompt: string,
    callbacks: StreamCallbacks,
    config: Partial<LLMConfig> = {}
  ): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    try {
      const stream = await this.client.chat.completions.create({
        model: mergedConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a furniture design expert AI assistant. Always provide accurate, practical advice.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
        stream: true
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        fullResponse += token;
        
        if (callbacks.onToken) {
          callbacks.onToken(token);
        }
      }
      
      if (callbacks.onComplete) {
        callbacks.onComplete(fullResponse);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
    }
  }

  /**
   * Make a simple completion call
   */
  async complete(
    prompt: string,
    config: Partial<LLMConfig> = {}
  ): Promise<string> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    const completion = await this.client.chat.completions.create({
      model: mergedConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a furniture design expert AI assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: mergedConfig.temperature,
      max_tokens: mergedConfig.maxTokens
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = this.costPerThousand[model] || this.costPerThousand['gpt-3.5-turbo-1106'];
    
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    
    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
  }

  /**
   * Count tokens in a string (approximate)
   */
  estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get total cost for the session
   */
  private totalCost = 0;
  
  getTotalCost(): number {
    return this.totalCost;
  }

  resetCost(): void {
    this.totalCost = 0;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();

// Export schemas for structured outputs
export const IntentClassificationSchema = z.object({
  primary_intent: z.enum([
    'design_initiation',
    'dimension_specification',
    'material_selection',
    'joinery_method',
    'style_aesthetic',
    'modification_request',
    'constraint_specification',
    'validation_check',
    'assembly_query',
    'export_request',
    'clarification_needed'
  ]),
  secondary_intents: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  entities: z.object({
    furniture_type: z.string().optional(),
    dimensions: z.array(z.object({
      type: z.string(),
      value: z.number(),
      unit: z.string()
    })).optional(),
    materials: z.array(z.string()).optional(),
    style: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    features: z.array(z.string()).optional()
  }),
  requires_clarification: z.boolean(),
  clarification_prompts: z.array(z.string()).optional(),
  suggested_next_intents: z.array(z.string())
});
