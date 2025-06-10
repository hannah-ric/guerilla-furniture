import { z } from 'zod';
import { Agent, AgentContext } from './base/Agent';
import { 
  IntentType,
  BaseAgentResponse as AgentResponse,
  MaterialAgentResponse 
} from '@/lib/types';
import { FurnitureKnowledgeGraph } from '@/services/knowledge/FurnitureKnowledgeGraph';
import { PROMPTS, formatPrompt } from '@/lib/prompts';
import { openAIService } from '@/services/api/openai';

// Schema for structured material selection
const MaterialSelectionSchema = z.object({
  primary_material: z.object({
    name: z.string(),
    type: z.enum(['solid_wood', 'plywood', 'mdf', 'particle_board', 'metal', 'glass', 'other']),
    species: z.string().optional(),
    properties: z.object({
      workability: z.enum(['easy', 'moderate', 'difficult']),
      cost_per_board_foot: z.number(),
      indoor_outdoor: z.enum(['indoor', 'outdoor', 'both']),
      hardness: z.number().optional()
    }),
    reasoning: z.string()
  }),
  alternatives: z.array(z.object({
    name: z.string(),
    reason: z.string(),
    cost_relative: z.enum(['cheaper', 'similar', 'more_expensive'])
  })),
  cost_estimate: z.number(),
  board_feet_needed: z.number(),
  compatibility_notes: z.object({
    with_dimensions: z.string(),
    with_environment: z.string(),
    with_joinery: z.string().optional()
  })
});

export class MaterialAgent extends Agent {
  name = 'material_agent';

  constructor(knowledgeGraph: FurnitureKnowledgeGraph) {
    super(knowledgeGraph);
    this.interestedEvents = ['dimensions_updated', 'constraint_updated'];
  }

  canHandle(intent: IntentType): boolean {
    return intent === IntentType.MATERIAL_SELECTION ||
           intent === IntentType.CONSTRAINT_SPECIFICATION;
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    const currentDesign = context.getCurrentDesign();
    
    try {
      // Gather context for material selection
      const constraints = await this.gatherConstraints(currentDesign);
      const knowledgeContext = this.getKnowledgeContext(currentDesign);
      
      // Prepare prompt with all context
      const prompt = formatPrompt(PROMPTS.MATERIAL_SELECTION_PROMPT, {
        furniture_type: currentDesign.furniture_type || 'general',
        dimensions: JSON.stringify(currentDesign.dimensions || {}),
        environment: constraints.environment || 'indoor',
        budget_level: constraints.budget || 'medium',
        skill_level: currentDesign.skill_level || 'intermediate',
        input: input,
        available_materials: knowledgeContext.availableMaterials.join(', '),
        span_requirements: knowledgeContext.spanRequirements
      });

      // Make LLM call with structured output
      const response = await openAIService.structuredCall(
        prompt,
        MaterialSelectionSchema,
        {
          model: 'gpt-3.5-turbo-1106',
          temperature: 0.2, // Slightly more creative for alternatives
          maxTokens: 1000
        }
      );

      const selection = response.data;

      // Validate with knowledge graph
      const materialProps = this.knowledgeGraph.materialProperties.get(selection.primary_material.name);
      if (materialProps) {
        // Enrich with actual properties
        selection.primary_material.properties = {
          ...selection.primary_material.properties,
          ...materialProps
        };
      }

      // Check compatibility
      const compatibility = this.validateMaterialCompatibility(
        selection.primary_material,
        currentDesign,
        constraints
      );

      // Format response
      const materialResponse: MaterialAgentResponse = {
        primary_material: {
          name: selection.primary_material.name,
          type: selection.primary_material.type,
          properties: selection.primary_material.properties,
          cost_estimate: selection.cost_estimate
        },
        alternatives: selection.alternatives.map(alt => ({
          name: alt.name,
          reason: alt.reason,
          cost_estimate: this.estimateCost(alt.name, selection.board_feet_needed)
        })),
        compatibility
      };

      return this.createSuccessResponse(materialResponse, {
        suggestions: this.generateMaterialSuggestions(selection, currentDesign, compatibility),
        next_steps: ['Select joinery methods compatible with ' + selection.primary_material.name],
        confidence: response.usage.estimatedCost < 0.02 ? 0.9 : 0.85
      });
      
    } catch (error) {
      console.error('Material selection failed:', error);
      
      // Fall back to rule-based selection
      const fallbackResult = this.selectMaterialWithRules(input, currentDesign);
      
      return this.createSuccessResponse(fallbackResult, {
        suggestions: ['Consider your budget and skill level when choosing materials'],
        confidence: 0.6
      });
    }
  }

  private async gatherConstraints(design: any): Promise<any> {
    const constraints: any = {
      budget: 'medium',
      environment: 'indoor',
      workability: 'moderate'
    };
    
    // Extract from design
    if (design.constraints?.budget) {
      constraints.budget = design.constraints.budget;
    }
    
    if (design.constraints?.environment) {
      constraints.environment = design.constraints.environment;
    }
    
    if (design.skill_level === 'beginner') {
      constraints.workability = 'easy';
    }
    
    // Dimensional constraints
    if (design.dimensions) {
      const span = design.dimensions.width || 0;
      constraints.minThickness = this.knowledgeGraph.getMinThickness('pine', span);
    }
    
    return constraints;
  }

  private getKnowledgeContext(design: any): any {
    const availableMaterials = Array.from(this.knowledgeGraph.materialProperties.keys());
    
    let spanRequirements = '';
    if (design.dimensions?.width) {
      const span = design.dimensions.width;
      spanRequirements = `Maximum span of ${span}" requires consideration of material thickness and strength.`;
    }
    
    return {
      availableMaterials,
      spanRequirements
    };
  }

  private validateMaterialCompatibility(
    material: any,
    design: any,
    constraints: any
  ): any {
    const compatibility = {
      with_dimensions: true,
      with_environment: true,
      with_budget: true
    };
    
    // Check span requirements
    if (design.dimensions?.width) {
      const maxSpan = this.knowledgeGraph.getMaxSpan(
        material.name,
        design.board_thickness || 0.75
      );
      compatibility.with_dimensions = design.dimensions.width <= maxSpan;
    }
    
    // Check environment
    if (constraints.environment === 'outdoor' && material.properties.indoor_outdoor === 'indoor') {
      compatibility.with_environment = false;
    }
    
    // Check budget (simplified)
    const budgetLimits: Record<string, number> = {
      low: 5,
      medium: 10,
      high: 20
    };
    
    if (constraints.budget && budgetLimits[constraints.budget]) {
      compatibility.with_budget = material.properties.cost_per_board_foot <= budgetLimits[constraints.budget];
    }
    
    return compatibility;
  }

  private generateMaterialSuggestions(
    selection: any,
    design: any,
    compatibility: any
  ): string[] {
    const suggestions: string[] = [];
    const material = selection.primary_material;
    
    // Workability tips
    if (material.properties.workability === 'easy') {
      suggestions.push(`${material.name} is beginner-friendly and forgiving to work with`);
    } else if (material.properties.workability === 'difficult') {
      suggestions.push(`${material.name} requires sharp tools and careful handling`);
    }
    
    // Cost insights
    if (material.properties.cost_per_board_foot < 5) {
      suggestions.push('This is a cost-effective choice for your project');
    } else if (material.properties.cost_per_board_foot > 10) {
      suggestions.push(`Premium material - total cost estimate: $${selection.cost_estimate}`);
    }
    
    // Compatibility warnings
    if (!compatibility.with_dimensions) {
      suggestions.push('Consider thicker stock or add support for this span');
    }
    
    if (!compatibility.with_environment) {
      suggestions.push('This material may not be suitable for outdoor use');
    }
    
    // Wood movement for solid wood
    if (material.type === 'solid_wood' && design.dimensions?.width > 12) {
      suggestions.push('Remember to account for wood movement in wide panels');
    }
    
    return suggestions;
  }

  private estimateCost(materialName: string, boardFeet: number): number {
    const props = this.knowledgeGraph.materialProperties.get(materialName);
    if (!props) return 100; // Default estimate
    
    return Math.ceil(boardFeet * props.cost_per_board_foot);
  }

  // Fallback rule-based selection
  private selectMaterialWithRules(input: string, design: any): MaterialAgentResponse {
    const lower = input.toLowerCase();
    
    // Detect specific wood mentions
    const woodTypes = ['oak', 'pine', 'maple', 'walnut', 'cherry', 'plywood', 'mdf'];
    let selectedWood = 'pine'; // Default
    
    for (const wood of woodTypes) {
      if (lower.includes(wood)) {
        selectedWood = wood;
        break;
      }
    }
    
    // Get properties from knowledge graph
    const props = this.knowledgeGraph.materialProperties.get(selectedWood) || {
      workability: 'moderate',
      cost_per_board_foot: 5,
      indoor_outdoor: 'indoor'
    };
    
    // Estimate cost (simplified)
    const boardFeet = this.estimateBoardFeet(design);
    const costEstimate = Math.ceil(boardFeet * props.cost_per_board_foot);
    
    // Find alternatives
    const alternatives = this.knowledgeGraph.suggestAlternatives(selectedWood, {
      maxCost: props.cost_per_board_foot * 1.5,
      environment: design.environment || 'indoor'
    });
    
    return {
      primary_material: {
        name: selectedWood,
        type: selectedWood.includes('plywood') || selectedWood === 'mdf' ? 'plywood' : 'solid_wood',
        properties: props,
        cost_estimate: costEstimate
      },
      alternatives: alternatives.map(alt => ({
        name: alt.material,
        reason: alt.reason,
        cost_estimate: this.estimateCost(alt.material, boardFeet)
      })),
      compatibility: {
        with_dimensions: true,
        with_environment: true,
        with_budget: true
      }
    };
  }

  private estimateBoardFeet(design: any): number {
    if (design.material_requirements?.board_feet) {
      return design.material_requirements.board_feet;
    }
    
    // Simple estimate based on furniture type
    const estimates: Record<string, number> = {
      bookshelf: 20,
      table: 15,
      chair: 8,
      nightstand: 10,
      cabinet: 25
    };
    
    return estimates[design.furniture_type] || 15;
  }
}