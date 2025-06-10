import { Agent, AgentContext } from './base/Agent';
import { 
  IntentType,
  BaseAgentResponse as AgentResponse,
  JoineryAgentResponse,
  JoineryType 
} from '@/lib/types';
import { FurnitureKnowledgeGraph } from '@/services/knowledge/FurnitureKnowledgeGraph';

export class JoineryAgent extends Agent {
  name = 'joinery_agent';

  constructor(knowledgeGraph: FurnitureKnowledgeGraph) {
    super(knowledgeGraph);
    this.interestedEvents = ['material_selected', 'tool_constraint_updated'];
  }

  canHandle(intent: IntentType): boolean {
    return intent === IntentType.JOINERY_METHOD ||
           intent === IntentType.CONSTRAINT_SPECIFICATION;
  }

  async process(input: string, context: AgentContext): Promise<AgentResponse> {
    const currentDesign = context.getCurrentDesign();
    
    try {
      // Extract joinery preferences
      const preferences = this.extractJoineryPreferences(input);
      
      // Get available tools
      const tools = this.getAvailableTools(input, currentDesign);
      
      // Select appropriate joinery
      const recommendation = this.selectJoinery(
        currentDesign,
        preferences,
        tools
      );
      
      const response: JoineryAgentResponse = {
        primary_method: recommendation.primary,
        alternatives: recommendation.alternatives,
        joint_locations: recommendation.locations,
        hardware_needed: recommendation.hardware
      };
      
      return this.createSuccessResponse(response, {
        suggestions: this.generateSuggestions(recommendation, currentDesign),
        next_steps: ['Review assembly sequence', 'Validate structural integrity']
      });
      
    } catch (error) {
      console.error('Joinery selection failed:', error);
      
      return this.createErrorResponse(
        'Could not determine joinery method',
        ['Specify your tool availability or preferred joint type']
      );
    }
  }

  private extractJoineryPreferences(input: string): any {
    const preferences: any = {};
    const lower = input.toLowerCase();
    
    // Specific joint types
    const jointTypes = ['mortise', 'tenon', 'dovetail', 'dowel', 'pocket', 'biscuit'];
    for (const joint of jointTypes) {
      if (lower.includes(joint)) {
        preferences.specificJoint = joint;
        break;
      }
    }
    
    // Strength requirements
    if (/strong|heavy|sturdy/i.test(input)) {
      preferences.strength = 'high';
    }
    
    // Visibility
    if (/hidden|invisible|clean/i.test(input)) {
      preferences.visibility = 'hidden';
    }
    
    return preferences;
  }

  private getAvailableTools(input: string, design: any): string[] {
    // Basic tools everyone has
    const basicTools = ['drill', 'saw', 'screwdriver', 'clamps'];
    
    // Check for specific tool mentions
    if (/pocket\s*hole\s*jig/i.test(input)) {
      basicTools.push('pocket_hole_jig');
    }
    
    if (/router|table\s*saw/i.test(input)) {
      basicTools.push('router', 'table_saw');
    }
    
    // Add based on skill level
    if (design.skill_level === 'advanced') {
      basicTools.push('chisel', 'dovetail_saw', 'marking_gauge');
    }
    
    return basicTools;
  }

  private selectJoinery(design: any, preferences: any, tools: string[]): any {
    const material = design.materials?.[0] || 'pine';
    const furnitureType = design.furniture_type || 'general';
    
    // Get compatible joints
    const compatibleJoints = this.knowledgeGraph.getCompatibleJoinery(material);
    
    // Filter by available tools
    const feasibleJoints = compatibleJoints.filter((joint: JoineryType) => {
      const requiredTools = this.knowledgeGraph.getRequiredTools(joint);
      return requiredTools.every(tool => tools.includes(tool));
    });
    
    // Score joints
    const scoredJoints = feasibleJoints.map((joint: JoineryType) => {
      let score = 1.0;
      const strength = this.knowledgeGraph.getJointStrength(joint, material);
      
      // Strength scoring
      if (preferences.strength === 'high' && strength > 500) {
        score *= 1.5;
      }
      
      // Specific joint preference
      if (preferences.specificJoint && joint.includes(preferences.specificJoint)) {
        score *= 2.0;
      }
      
      return {
        name: joint,
        strength: strength / 100, // Normalize to 1-10 scale
        difficulty: this.getJointDifficulty(joint),
        tools: this.knowledgeGraph.getRequiredTools(joint),
        score
      };
    });
    
    // Sort by score
    scoredJoints.sort((a, b) => b.score - a.score);
    
    return {
      primary: scoredJoints[0] || this.getDefaultJoint(),
      alternatives: scoredJoints.slice(1, 4),
      locations: this.determineJointLocations(design),
      hardware: this.calculateHardware(scoredJoints[0], design)
    };
  }

  private getJointDifficulty(joint: string): string {
    const difficulties: Record<string, string> = {
      'screw': 'beginner',
      'pocket_hole': 'beginner',
      'dowel': 'intermediate',
      'biscuit': 'intermediate',
      'dado': 'intermediate',
      'mortise_tenon': 'advanced',
      'dovetail': 'advanced'
    };
    
    return difficulties[joint] || 'intermediate';
  }

  private getDefaultJoint(): any {
    return {
      name: 'screw',
      strength: 3,
      difficulty: 'beginner',
      tools: ['drill', 'screwdriver']
    };
  }

  private determineJointLocations(design: any): any[] {
    const locations: any[] = [];
    const furnitureType = design.furniture_type;
    
    if (furnitureType === 'table') {
      locations.push(
        { location: 'leg-to-apron', method: 'primary', quantity: 8 },
        { location: 'apron-corners', method: 'primary', quantity: 4 }
      );
    } else if (furnitureType === 'bookshelf') {
      const shelfCount = Math.floor((design.dimensions?.height || 72) / 12) - 1;
      locations.push(
        { location: 'shelf-to-side', method: 'primary', quantity: shelfCount * 4 },
        { location: 'back-attachment', method: 'screw', quantity: 12 }
      );
    }
    
    return locations;
  }

  private calculateHardware(joint: any, design: any): any[] {
    const hardware: any[] = [];
    
    if (!joint) return hardware;
    
    if (joint.name === 'pocket_hole') {
      hardware.push({
        item: 'pocket screws',
        quantity: 50,
        size: '1.25"'
      });
    } else if (joint.name === 'screw') {
      hardware.push({
        item: 'wood screws',
        quantity: 50,
        size: '1.5"'
      });
    }
    
    return hardware;
  }

  private generateSuggestions(recommendation: any, design: any): string[] {
    const suggestions: string[] = [];
    const joint = recommendation.primary;
    
    if (joint.difficulty === 'advanced') {
      suggestions.push('Practice this joint on scrap wood first');
    }
    
    if (design.materials?.[0] === 'pine' && joint.name === 'mortise_tenon') {
      suggestions.push('Pre-drill to prevent splitting in soft wood');
    }
    
    return suggestions;
  }
}
