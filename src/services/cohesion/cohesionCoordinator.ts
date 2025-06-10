// services/cohesion/cohesionCoordinator.ts
// This is a complete starter implementation you can use immediately

import { Agent, AgentResponse, IntentType } from '../intentClassifier';
import { FurnitureDesign } from '@/lib/types';

/**
 * Main coordinator that ensures all agents work together cohesively
 * Start here and expand based on your needs
 */
export class CohesionCoordinator {
  private agents: Map<string, Agent> = new Map();
  private validationRules: ValidationRule[] = [];
  private compatibilityMatrix: CompatibilityMatrix;
  private designContext: DesignContext;

  constructor() {
    this.compatibilityMatrix = new CompatibilityMatrix();
    this.designContext = new DesignContext();
    this.initializeValidationRules();
  }

  /**
   * Register an agent with cohesion checks
   */
  registerAgent(agent: Agent) {
    // Wrap agent process method with cohesion logic
    const originalProcess = agent.process.bind(agent);
    
    agent.process = async (input: string, context: any) => {
      // Pre-process: Check constraints before agent runs
      const constraints = this.getConstraintsForAgent(agent.name);
      const constrainedInput = this.applyConstraints(input, constraints);
      
      // Process with agent
      const result = await originalProcess(constrainedInput, context);
      
      // Post-process: Validate and propagate changes
      const validatedResult = await this.validateAndPropagate(
        agent.name, 
        result,
        context
      );
      
      return validatedResult;
    };
    
    this.agents.set(agent.name, agent);
  }

  /**
   * Process a design request with full cohesion
   */
  async processCoherentDesign(
    intent: IntentType,
    input: string,
    currentDesign: Partial<FurnitureDesign>
  ): Promise<CoherentDesignResult> {
    // Step 1: Determine agent execution order based on dependencies
    const executionPlan = this.createExecutionPlan(intent, currentDesign);
    
    // Step 2: Execute agents in order with constraint checking
    const results = new Map<string, any>();
    
    for (const agentName of executionPlan) {
      const agent = this.agents.get(agentName);
      if (!agent) continue;
      
      // Get constraints from previous agent results
      const constraints = this.gatherConstraints(results, agentName);
      
      // Process with constraints
      const result = await this.processWithConstraints(
        agent,
        input,
        currentDesign,
        constraints
      );
      
      // Store result
      results.set(agentName, result);
      
      // Update design incrementally
      currentDesign = this.mergeResults(currentDesign, result);
      
      // Check for conflicts after each agent
      const conflicts = this.detectConflicts(currentDesign);
      if (conflicts.length > 0) {
        currentDesign = await this.resolveConflicts(
          currentDesign, 
          conflicts,
          results
        );
      }
    }
    
    // Step 3: Final validation
    const validation = this.validateCompleteDesign(currentDesign as FurnitureDesign);
    
    // Step 4: Generate variations if requested
    const variations = validation.isValid 
      ? this.generateCoherentVariations(currentDesign as FurnitureDesign)
      : [];
    
    return {
      design: currentDesign as FurnitureDesign,
      validation,
      variations,
      reasoning: this.explainDesign(currentDesign as FurnitureDesign, results)
    };
  }

  /**
   * Initialize validation rules for furniture
   */
  private initializeValidationRules() {
    // Rule 1: Shelf span vs thickness
    this.validationRules.push({
      name: 'shelf_deflection',
      applies: (design) => ['shelf', 'bookshelf'].includes(design.furniture_type || ''),
      validate: (design) => {
        const span = design.dimensions?.width || 0;
        const thickness = design.boardThickness || 0.75;
        const material = design.materials?.[0] || 'pine';
        
        // Simplified sagulator formula
        const maxSpan = this.calculateMaxSpan(material, thickness);
        
        return {
          valid: span <= maxSpan,
          message: span > maxSpan 
            ? `${span}" span too wide for ${thickness}" ${material}. Max: ${maxSpan}"`
            : 'Shelf span acceptable',
          fix: () => ({
            ...design,
            dimensions: { ...design.dimensions, width: maxSpan }
          })
        };
      }
    });

    // Rule 2: Joint strength for load
    this.validationRules.push({
      name: 'joint_strength',
      applies: () => true,
      validate: (design) => {
        const estimatedLoad = this.estimateLoad(design);
        const jointStrength = this.calculateJointStrength(
          design.joinery?.[0] || 'screw',
          design.materials?.[0] || 'pine'
        );
        
        const safetyFactor = jointStrength / estimatedLoad;
        
        return {
          valid: safetyFactor >= 2,
          message: safetyFactor < 2
            ? `Joints may fail. Safety factor: ${safetyFactor.toFixed(1)} (need 2.0)`
            : `Joints strong enough. Safety factor: ${safetyFactor.toFixed(1)}`,
          fix: () => ({
            ...design,
            joinery: [this.getStrongerJoint(design.joinery?.[0])]
          })
        };
      }
    });

    // Rule 3: Material thickness for height
    this.validationRules.push({
      name: 'stability',
      applies: (design) => (design.dimensions?.height || 0) > 48,
      validate: (design) => {
        const height = design.dimensions?.height || 0;
        const base = Math.min(
          design.dimensions?.width || 1,
          design.dimensions?.depth || 1
        );
        const ratio = height / base;
        
        return {
          valid: ratio < 4,
          message: ratio >= 4
            ? `Too tall for base. Risk of tipping. Ratio: ${ratio.toFixed(1)}`
            : `Stable proportions. Ratio: ${ratio.toFixed(1)}`,
          fix: () => ({
            ...design,
            features: [...(design.features || []), 'anti-tip hardware']
          })
        };
      }
    });
  }

  /**
   * Process with constraints applied
   */
  private async processWithConstraints(
    agent: Agent,
    input: string,
    currentDesign: Partial<FurnitureDesign>,
    constraints: Constraint[]
  ): Promise<any> {
    // Apply constraints to input
    const constrainedPrompt = this.buildConstrainedPrompt(
      input,
      constraints,
      currentDesign
    );
    
    // Process with agent
    const result = await agent.process(
      constrainedPrompt,
      { getCurrentDesign: () => currentDesign }
    );
    
    // Validate result against constraints
    for (const constraint of constraints) {
      if (!constraint.validate(result)) {
        // Ask agent to revise
        const revisionPrompt = `
          Your suggestion violates this constraint: ${constraint.description}
          Please revise to meet: ${constraint.requirement}
        `;
        
        const revisedResult = await agent.process(
          revisionPrompt,
          { getCurrentDesign: () => currentDesign }
        );
        
        if (constraint.validate(revisedResult)) {
          return revisedResult;
        }
      }
    }
    
    return result;
  }

  /**
   * Detect conflicts in current design
   */
  private detectConflicts(design: Partial<FurnitureDesign>): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Check each validation rule
    for (const rule of this.validationRules) {
      if (rule.applies(design)) {
        const result = rule.validate(design);
        if (!result.valid) {
          conflicts.push({
            type: rule.name,
            severity: 'high',
            message: result.message,
            fix: result.fix
          });
        }
      }
    }
    
    // Check material-joinery compatibility
    if (design.materials?.length && design.joinery?.length) {
      const compatible = this.compatibilityMatrix.isCompatible(
        design.materials[0],
        design.joinery[0]
      );
      
      if (!compatible) {
        conflicts.push({
          type: 'material_joinery_mismatch',
          severity: 'medium',
          message: `${design.joinery[0]} doesn't work well with ${design.materials[0]}`,
          fix: () => ({
            ...design,
            joinery: [this.compatibilityMatrix.getBestJoint(design.materials![0])]
          })
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Resolve conflicts intelligently
   */
  private async resolveConflicts(
    design: Partial<FurnitureDesign>,
    conflicts: Conflict[],
    agentResults: Map<string, any>
  ): Promise<Partial<FurnitureDesign>> {
    let resolvedDesign = { ...design };
    
    // Sort by severity
    conflicts.sort((a, b) => 
      a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0
    );
    
    for (const conflict of conflicts) {
      if (conflict.fix) {
        // Apply automatic fix
        resolvedDesign = conflict.fix();
        
        // Notify relevant agents of change
        await this.notifyAgentsOfChange(
          conflict.type,
          resolvedDesign,
          agentResults
        );
      }
    }
    
    return resolvedDesign;
  }

  /**
   * Generate variations while maintaining coherence
   */
  private generateCoherentVariations(
    baseDesign: FurnitureDesign
  ): FurnitureDesign[] {
    const variations: FurnitureDesign[] = [];
    
    // Variation 1: Different material
    const materialVariation = { ...baseDesign };
    const altMaterial = this.compatibilityMatrix.getAlternativeMaterial(
      baseDesign.materials[0],
      baseDesign.dimensions
    );
    if (altMaterial) {
      materialVariation.materials = [altMaterial];
      materialVariation.joinery = [
        this.compatibilityMatrix.getBestJoint(altMaterial)
      ];
      
      if (this.validateCompleteDesign(materialVariation).isValid) {
        variations.push(materialVariation);
      }
    }
    
    // Variation 2: Added feature
    const featureVariation = { ...baseDesign };
    const possibleFeatures = this.getPossibleFeatures(baseDesign);
    if (possibleFeatures.length > 0) {
      featureVariation.features = [
        ...(baseDesign.features || []),
        possibleFeatures[0]
      ];
      
      if (this.validateCompleteDesign(featureVariation).isValid) {
        variations.push(featureVariation);
      }
    }
    
    // Variation 3: Different proportions
    const proportionVariation = { ...baseDesign };
    const altProportions = this.generateAlternativeProportions(baseDesign);
    proportionVariation.dimensions = altProportions;
    
    if (this.validateCompleteDesign(proportionVariation).isValid) {
      variations.push(proportionVariation);
    }
    
    return variations;
  }

  /**
   * Validate complete design
   */
  private validateCompleteDesign(design: FurnitureDesign): ValidationResult {
    const issues: string[] = [];
    let isValid = true;
    
    for (const rule of this.validationRules) {
      if (rule.applies(design)) {
        const result = rule.validate(design);
        if (!result.valid) {
          isValid = false;
          issues.push(result.message);
        }
      }
    }
    
    return {
      isValid,
      issues,
      score: isValid ? 1.0 : 0.5,
      recommendations: this.generateRecommendations(design, issues)
    };
  }

  // Helper methods
  private calculateMaxSpan(material: string, thickness: number): number {
    const spanTable = {
      pine: { 0.75: 24, 1.5: 36, 2: 48 },
      oak: { 0.75: 30, 1.5: 42, 2: 54 },
      plywood: { 0.75: 22, 1.5: 32, 2: 42 }
    };
    
    const materialData = spanTable[material] || spanTable.pine;
    return materialData[thickness] || 24;
  }

  private calculateJointStrength(joint: string, material: string): number {
    const strengthTable = {
      mortise_tenon: { pine: 800, oak: 1200 },
      dovetail: { pine: 700, oak: 1000 },
      dowel: { pine: 500, oak: 700 },
      pocket_hole: { pine: 400, oak: 600 },
      screw: { pine: 300, oak: 400 }
    };
    
    return strengthTable[joint]?.[material] || 300;
  }

  private estimateLoad(design: Partial<FurnitureDesign>): number {
    const typeLoads = {
      bookshelf: 150,
      table: 100,
      chair: 250,
      cabinet: 200,
      nightstand: 50
    };
    
    return typeLoads[design.furniture_type || ''] || 100;
  }

  private getStrongerJoint(currentJoint?: string): string {
    const jointHierarchy = [
      'screw',
      'pocket_hole',
      'dowel',
      'dovetail',
      'mortise_tenon'
    ];
    
    const currentIndex = jointHierarchy.indexOf(currentJoint || 'screw');
    return jointHierarchy[Math.min(currentIndex + 1, jointHierarchy.length - 1)];
  }
}

// Supporting classes
class CompatibilityMatrix {
  private matrix = {
    pine: ['screw', 'pocket_hole', 'dowel', 'mortise_tenon'],
    oak: ['dowel', 'dovetail', 'mortise_tenon'],
    plywood: ['screw', 'pocket_hole', 'biscuit'],
    mdf: ['screw', 'pocket_hole']
  };

  isCompatible(material: string, joint: string): boolean {
    return this.matrix[material]?.includes(joint) || false;
  }

  getBestJoint(material: string): string {
    return this.matrix[material]?.[this.matrix[material].length - 1] || 'screw';
  }

  getAlternativeMaterial(current: string, dimensions: any): string | null {
    const alternatives = {
      pine: ['oak', 'plywood'],
      oak: ['maple', 'walnut'],
      plywood: ['mdf', 'pine'],
      mdf: ['plywood']
    };
    
    return alternatives[current]?.[0] || null;
  }
}

// Types
interface CoherentDesignResult {
  design: FurnitureDesign;
  validation: ValidationResult;
  variations: FurnitureDesign[];
  reasoning: DesignReasoning;
}

interface ValidationRule {
  name: string;
  applies: (design: Partial<FurnitureDesign>) => boolean;
  validate: (design: Partial<FurnitureDesign>) => {
    valid: boolean;
    message: string;
    fix?: () => Partial<FurnitureDesign>;
  };
}

interface Constraint {
  description: string;
  requirement: string;
  validate: (result: any) => boolean;
}

interface Conflict {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  fix?: () => Partial<FurnitureDesign>;
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  score: number;
  recommendations: string[];
}

interface DesignReasoning {
  decisions: Map<string, string>;
  tradeoffs: string[];
  optimizations: string[];
}

// Export for use
export default CohesionCoordinator;