// services/agents/DimensionAgent.ts
import { z } from 'zod';
import { Agent, AgentContext } from './base/Agent';
import { 
  IntentType,
  BaseAgentResponse as AgentResponse,
  DimensionAgentResponse 
} from '@/lib/types';
import { FurnitureKnowledgeGraph } from '@/services/knowledge/FurnitureKnowledgeGraph';
import { PROMPTS, formatPrompt } from '@/lib/prompts';
import { openAIService } from '@/services/api/openai';
import { Logger } from '@/lib/logger';

// Schema for structured dimension extraction
const DimensionExtractionSchema = z.object({
  measurements: z.array(z.object({
    component: z.string(),
    dimension_type: z.enum(['height', 'width', 'depth', 'thickness', 'diameter']),
    value: z.number(),
    unit: z.string(),
    converted_to_inches: z.number()
  })),
  total_dimensions: z.object({
    height: z.number().optional(),
    width: z.number().optional(), 
    depth: z.number().optional()
  }),
  material_requirements: z.object({
    board_feet: z.number(),
    sheet_goods_area: z.number().optional()
  }),
  ergonomic_validation: z.object({
    is_valid: z.boolean(),
    issues: z.array(z.string())
  })
});

export class DimensionAgent extends Agent {
  name = 'dimension_agent';

  constructor(knowledgeGraph: FurnitureKnowledgeGraph) {
    super(knowledgeGraph);
    this.interestedEvents = ['material_selected', 'constraint_updated'];
  }

  canHandle(intent: IntentType): boolean {
    return intent === IntentType.DIMENSION_SPECIFICATION ||
           intent === IntentType.MODIFICATION_REQUEST;
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    const currentDesign = context.getCurrentDesign();
    
    try {
      // Prepare prompt with furniture context
      const prompt = formatPrompt(PROMPTS.DIMENSION_EXTRACTION_PROMPT, {
        furniture_type: currentDesign.furniture_type || 'unknown',
        current_dimensions: JSON.stringify(currentDesign.dimensions || {}),
        input: input
      });

      // Make LLM call with structured output
      const response = await openAIService.structuredCall(
        prompt,
        DimensionExtractionSchema,
        {
          model: 'gpt-3.5-turbo-1106',
          temperature: 0.1,
          maxTokens: 800
        }
      );

      const dimensions = response.data;

      // Validate dimensions with knowledge graph
      const validation = this.validateDimensionsWithKnowledge(dimensions, currentDesign);
      
      // Merge ergonomic validation with knowledge validation
      if (validation.issues.length > 0) {
        dimensions.ergonomic_validation.issues.push(...validation.issues);
        dimensions.ergonomic_validation.is_valid = false;
      }

      // Check material constraints if materials exist
      if (this.query && currentDesign.materials?.length > 0) {
        const materialConstraints = await this.query('material_agent', {
          type: 'get_constraints',
          material: currentDesign.materials[0],
          dimensions: dimensions.total_dimensions
        });
        
        if (materialConstraints && materialConstraints.max_span) {
          const spanIssues = this.checkSpanConstraints(
            dimensions,
            materialConstraints.max_span
          );
          if (spanIssues.length > 0) {
            dimensions.ergonomic_validation.issues.push(...spanIssues);
            dimensions.ergonomic_validation.is_valid = false;
          }
        }
      }

      Logger.agent(this.name, 'Dimensions extracted', {
        total_dimensions: dimensions.total_dimensions,
        valid: dimensions.ergonomic_validation.is_valid
      });

      return this.createSuccessResponse(dimensions, {
        suggestions: this.generateIntelligentSuggestions(dimensions, currentDesign),
        validation_issues: dimensions.ergonomic_validation.issues,
        next_steps: ['Select materials', 'Choose joinery methods'],
        confidence: response.usage.estimatedCost < 0.01 ? 0.95 : 0.9
      });
      
    } catch (error) {
      Logger.error(this.name, 'Dimension extraction failed', error);
      
      // Fall back to rule-based extraction
      const fallbackResult = this.extractDimensionsWithRules(input, currentDesign);
      
      return this.createSuccessResponse(fallbackResult, {
        suggestions: ['Please specify dimensions more clearly'],
        validation_issues: fallbackResult.ergonomic_validation.issues,
        confidence: 0.6
      });
    }
  }

  private validateDimensionsWithKnowledge(dimensions: any, currentDesign: any): any {
    const issues: string[] = [];
    const furnitureType = currentDesign.furniture_type;
    const template = this.knowledgeGraph.getFurnitureTemplate(furnitureType);
    
    if (!template || !dimensions.total_dimensions) {
      return { issues };
    }

    // Check against standard dimensions
    const { width, height, depth } = dimensions.total_dimensions;
    const std = template.standard_dimensions;
    
    // Height validation
    if (height && std.height) {
      if (furnitureType === 'table' && (height < 28 || height > 32)) {
        issues.push(`Table height ${height}" is outside ergonomic range (28-32")`);
      } else if (furnitureType === 'chair' && (height < 30 || height > 36)) {
        issues.push(`Chair total height ${height}" is unusual (typical: 30-36")`);
      }
    }
    
    // Stability check
    if (height && width && depth) {
      const baseArea = Math.min(width, depth);
      const ratio = height / baseArea;
      if (ratio > 4) {
        issues.push(`Height to base ratio ${ratio.toFixed(1)} may cause instability`);
      }
    }
    
    // Span check
    if (width && furnitureType === 'bookshelf') {
      const thickness = currentDesign.board_thickness || 0.75;
      const maxSpan = this.knowledgeGraph.getMaxSpan('pine', thickness);
      if (width > maxSpan) {
        issues.push(`Shelf width ${width}" exceeds max span ${maxSpan}" for ${thickness}" thickness`);
      }
    }
    
    return { issues };
  }

  private checkSpanConstraints(dimensions: any, maxSpan: number): string[] {
    const issues: string[] = [];
    const span = dimensions.total_dimensions.width || 0;
    
    if (span > maxSpan) {
      issues.push(`Span of ${span}" exceeds maximum ${maxSpan}" for selected material`);
    }
    
    return issues;
  }

  private generateIntelligentSuggestions(dimensions: any, currentDesign: any): string[] {
    const suggestions: string[] = [];
    const template = this.knowledgeGraph.getFurnitureTemplate(
      currentDesign.furniture_type || 'table'
    );
    
    // Material suggestions based on size
    if (dimensions.material_requirements.board_feet > 50) {
      suggestions.push('Consider using sheet goods for large panels to reduce cost');
    }
    
    // Ergonomic suggestions
    if (template && template.standard_dimensions) {
      const std = template.standard_dimensions;
      const dims = dimensions.total_dimensions;
      
      if (dims.height && Math.abs(dims.height - std.height) > 2) {
        suggestions.push(`Standard ${currentDesign.furniture_type} height is ${std.height}"`);
      }
    }
    
    // Structural suggestions
    if (dimensions.total_dimensions.width > 36 && currentDesign.furniture_type === 'bookshelf') {
      suggestions.push('Add a center support for shelves over 36" wide');
    }
    
    return suggestions;
  }

  // Fallback rule-based extraction
  private extractDimensionsWithRules(input: string, currentDesign: any): DimensionAgentResponse {
    const measurements: DimensionAgentResponse['measurements'] = [];
    const dimensionRegex = /(\d+(?:\.\d+)?)\s*(inch|inches|foot|feet|ft|cm|mm|"|')/gi;
    let match;
    
    while ((match = dimensionRegex.exec(input)) !== null) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const convertedValue = this.convertToInches(value, unit);
      
      const dimensionType = this.inferDimensionType(
        input.substring(Math.max(0, match.index - 30), match.index),
        input
      ) as DimensionAgentResponse['measurements'][0]['dimension_type'];
      
      measurements.push({
        component: currentDesign.furniture_type || 'main',
        dimension_type: dimensionType || 'height',
        value,
        unit,
        converted_to_inches: convertedValue
      });
    }
    
    // Calculate total dimensions
    const total_dimensions: DimensionAgentResponse['total_dimensions'] = {};
    measurements.forEach(m => {
      if (['height', 'width', 'depth'].includes(m.dimension_type)) {
        total_dimensions[m.dimension_type] = m.converted_to_inches;
      }
    });
    
    // Apply defaults if missing
    this.applyDefaultDimensions(total_dimensions, currentDesign.furniture_type);
    
    // Calculate material requirements
    const materialReqs = this.calculateMaterialRequirements({ total_dimensions });
    
    // Basic validation
    const validation = this.validateDimensionsWithKnowledge(
      { total_dimensions },
      currentDesign
    );
    
    return {
      measurements,
      total_dimensions,
      material_requirements: materialReqs,
      ergonomic_validation: {
        is_valid: validation.issues.length === 0,
        issues: validation.issues
      }
    };
  }

  private convertToInches(value: number, unit: string): number {
    const conversions: Record<string, number> = {
      'inch': 1,
      'inches': 1,
      '"': 1,
      'foot': 12,
      'feet': 12,
      'ft': 12,
      "'": 12,
      'cm': 0.393701,
      'mm': 0.0393701
    };
    
    return value * (conversions[unit] || 1);
  }

  private inferDimensionType(beforeText: string, fullText: string): string {
    if (/tall|height/i.test(beforeText)) return 'height';
    if (/wide|width/i.test(beforeText)) return 'width';
    if (/deep|depth/i.test(beforeText)) return 'depth';
    if (/thick/i.test(beforeText)) return 'thickness';
    
    // Try to infer from position in sentence
    const lowerFull = fullText.toLowerCase();
    if (lowerFull.includes('by') || lowerFull.includes('x')) {
      const parts = lowerFull.split(/\s*(?:by|x)\s*/);
      const currentIndex = parts.findIndex(p => beforeText.includes(p));
      
      if (currentIndex === 0) return 'width';
      if (currentIndex === 1) return 'height';
      if (currentIndex === 2) return 'depth';
    }
    
    return 'height'; // Default to height if unknown
  }

  private applyDefaultDimensions(dimensions: any, furnitureType?: string) {
    const template = this.knowledgeGraph.getFurnitureTemplate(furnitureType || 'table');
    
    if (!dimensions.width && template.standard_dimensions?.width) {
      dimensions.width = template.standard_dimensions.width;
    }
    if (!dimensions.height && template.standard_dimensions?.height) {
      dimensions.height = template.standard_dimensions.height;
    }
    if (!dimensions.depth && template.standard_dimensions?.depth) {
      dimensions.depth = template.standard_dimensions.depth;
    }
  }

  private calculateMaterialRequirements(dimensions: any): any {
    const { width = 24, height = 30, depth = 18 } = dimensions.total_dimensions;
    
    // Simplified calculation
    let boardFeet = 0;
    
    // For a basic structure
    if (dimensions.measurements?.some((m: any) => m.component.includes('shelf'))) {
      // Bookshelf-like: sides + shelves
      const sides = 2 * (height * depth * 0.75) / 144; // 3/4" thick
      const shelfCount = Math.floor(height / 12);
      const shelves = shelfCount * (width * depth * 0.75) / 144;
      boardFeet = sides + shelves;
    } else {
      // Table-like: top + legs/aprons
      const top = (width * depth * 1) / 144; // 1" thick top
      const structure = 4; // Approximate for legs/aprons
      boardFeet = top + structure;
    }
    
    // Add waste factor
    boardFeet *= 1.15;
    
    return {
      board_feet: Math.ceil(boardFeet),
      sheet_goods_area: width * depth > 2000 ? Math.ceil((width * depth) / 144) : undefined
    };
  }
}