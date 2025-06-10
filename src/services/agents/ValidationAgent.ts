import { Agent, AgentResponse, AgentContext, ValidationAgentResponse } from './base/Agent';
import { IntentType } from '@/lib/types';
import { FurnitureKnowledgeGraph } from '@/services/knowledge/FurnitureKnowledgeGraph';

export class ValidationAgent extends Agent {
  name = 'validation_agent';

  constructor(knowledgeGraph: FurnitureKnowledgeGraph) {
    super(knowledgeGraph);
    this.interestedEvents = ['design_updated', 'material_changed', 'dimensions_changed'];
  }

  canHandle(intent: IntentType): boolean {
    return intent === IntentType.VALIDATION_CHECK ||
           intent === IntentType.MODIFICATION_REQUEST;
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    const currentDesign = context.getCurrentDesign();
    
    try {
      // Run physics validation
      const physics = this.validatePhysics(currentDesign);
      
      // Check material strength
      const materialStrength = this.validateMaterialStrength(currentDesign);
      
      // Check joinery adequacy
      const joineryStrength = this.validateJoineryStrength(currentDesign);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        physics,
        materialStrength,
        joineryStrength
      );
      
      const response: ValidationAgentResponse = {
        is_valid: overallScore > 0.7,
        physics,
        material_strength: materialStrength,
        joinery_strength: joineryStrength,
        overall_score: overallScore
      };
      
      const issues = this.collectIssues(physics, materialStrength, joineryStrength);
      
      return this.createSuccessResponse(response, {
        validation_issues: issues,
        suggestions: this.generateImprovements(response, currentDesign),
        next_steps: response.is_valid ? 
          ['Generate cut list', 'Export plans'] : 
          ['Address validation issues']
      });
      
    } catch (error) {
      return this.createErrorResponse(
        'Could not complete validation',
        ['Ensure all design parameters are specified']
      );
    }
  }

  private validatePhysics(design: any): any {
    const dimensions = design.dimensions || {};
    const height = dimensions.height || 0;
    const width = dimensions.width || 1;
    const depth = dimensions.depth || 1;
    
    // Simple stability check
    const baseArea = width * depth;
    const heightToBaseRatio = height / Math.sqrt(baseArea);
    const stable = heightToBaseRatio < 3;
    
    // Load capacity (simplified)
    const material = design.materials?.[0] || 'pine';
    const thickness = design.board_thickness || 0.75;
    const span = Math.max(width, depth);
    
    const maxSpan = this.knowledgeGraph.getMaxSpan(material, thickness);
    const spanOk = span <= maxSpan;
    
    return {
      stable: stable && spanOk,
      max_load: this.calculateMaxLoad(design),
      safety_factor: stable ? 2.5 : 0.8,
      critical_points: [
        ...(stable ? [] : ['Base too small for height']),
        ...(spanOk ? [] : [`Span exceeds maximum for material`])
      ]
    };
  }

  private validateMaterialStrength(design: any): any {
    const material = design.materials?.[0];
    if (!material) {
      return {
        adequate: false,
        utilization: 0,
        warnings: ['No material specified']
      };
    }
    
    const validation = this.knowledgeGraph.validateMaterial(material, {
      span: design.dimensions?.width,
      thickness: design.board_thickness || 0.75,
      load: this.estimateLoad(design)
    });
    
    return {
      adequate: validation.valid,
      utilization: validation.score,
      warnings: validation.warnings
    };
  }

  private validateJoineryStrength(design: any): any {
    const joinery = design.joinery?.[0];
    const material = design.materials?.[0] || 'pine';
    
    if (!joinery) {
      return {
        sufficient: false,
        weakest_point: 'No joinery specified',
        improvements: ['Select appropriate joinery method']
      };
    }
    
    const jointStrength = this.knowledgeGraph.getJointStrength(
      joinery.type,
      material
    );
    
    const requiredStrength = this.estimateLoad(design) * 2; // Safety factor
    
    return {
      sufficient: jointStrength > requiredStrength,
      weakest_point: 'primary joints',
      improvements: jointStrength <= requiredStrength ? 
        ['Use stronger joinery method', 'Add reinforcement'] : []
    };
  }

  private calculateMaxLoad(design: any): number {
    // Simplified calculation
    const furnitureType = design.furniture_type;
    const baseLoads = {
      bookshelf: 30, // per shelf
      table: 100,
      chair: 300,
      cabinet: 50,
      nightstand: 50
    };
    
    const baseLoad = baseLoads[furnitureType] || 50;
    
    // Adjust for size
    const sizeFactor = (design.dimensions?.width || 24) / 24;
    
    return Math.round(baseLoad * sizeFactor);
  }

  private estimateLoad(design: any): number {
    return this.calculateMaxLoad(design) * 0.7; // Expected load is 70% of max
  }

  private calculateOverallScore(physics: any, material: any, joinery: any): number {
    let score = 1.0;
    
    if (!physics.stable) score *= 0.5;
    if (!material.adequate) score *= 0.6;
    if (!joinery.sufficient) score *= 0.7;
    
    // Bonus for over-engineering
    if (physics.safety_factor > 3) score *= 1.1;
    
    return Math.min(score, 1.0);
  }

  private collectIssues(physics: any, material: any, joinery: any): string[] {
    return [
      ...physics.critical_points,
      ...material.warnings,
      ...joinery.improvements
    ];
  }

  private generateImprovements(validation: any, design: any): string[] {
    const suggestions = [];
    
    if (validation.physics.safety_factor < 2) {
      suggestions.push('Consider adding cross-bracing for stability');
    }
    
    if (validation.material_strength.utilization > 0.8) {
      suggestions.push('Use thicker material for better safety margin');
    }
    
    if (!validation.joinery_strength.sufficient) {
      suggestions.push('Upgrade to stronger joinery method');
    }
    
    return suggestions;
  }
}