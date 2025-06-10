// services/knowledgeGraph/furnitureKnowledgeGraph.ts
// Complete knowledge graph implementation for furniture design

import { 
    Material, 
    MaterialType, 
    WoodSpecies, 
    JoineryType,
    FurnitureType,
    Dimensions,
    MaterialProperties,
    KnowledgeNode,
    Relationship,
    ValidationResult,
    FurnitureDesign
  } from '../../../lib/types';
  
  interface SpanTable {
    [thickness: string]: {
      [material: string]: number; // max span in inches
    };
  }
  
  interface JointStrengthTable {
    [jointType: string]: {
      [material: string]: {
        shear: number;  // pounds
        tension: number; // pounds
        compression: number; // pounds
      };
    };
  }
  
  /**
   * Central knowledge repository for furniture design
   * Contains engineering data, compatibility rules, and design patterns
   */
  export class FurnitureKnowledgeGraph {
    private nodes: Map<string, KnowledgeNode> = new Map();
    
    // Engineering tables
    private spanTables: SpanTable;
    private jointStrengthTable: JointStrengthTable;
    private materialProperties: Map<string, MaterialProperties>;
    
    // Compatibility matrices
    private materialJoineryCompatibility: Map<string, Set<string>>;
    private toolRequirements: Map<string, Set<string>>;
    
    // Design patterns
    private furnitureTemplates: Map<FurnitureType, any>;
    
    constructor() {
      this.initializeMaterialProperties();
      this.initializeSpanTables();
      this.initializeJointStrengthTables();
      this.initializeCompatibilityMatrices();
      this.initializeFurnitureTemplates();
      this.buildKnowledgeGraph();
    }
  
    /**
     * Initialize material properties database
     */
    private initializeMaterialProperties() {
      this.materialProperties = new Map([
        ['pine', {
          density: 35,  // lb/ft³
          hardness: 420, // Janka
          modulus_elasticity: 1_200_000, // psi
          modulus_rupture: 8_600, // psi
          workability: 'easy',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 3.50
        }],
        ['oak_red', {
          density: 47,
          hardness: 1290,
          modulus_elasticity: 1_820_000,
          modulus_rupture: 14_300,
          workability: 'moderate',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 6.50
        }],
        ['maple_hard', {
          density: 48,
          hardness: 1450,
          modulus_elasticity: 1_830_000,
          modulus_rupture: 15_800,
          workability: 'moderate',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 7.00
        }],
        ['walnut', {
          density: 43,
          hardness: 1010,
          modulus_elasticity: 1_680_000,
          modulus_rupture: 14_600,
          workability: 'easy',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 12.00
        }],
        ['cherry', {
          density: 41,
          hardness: 950,
          modulus_elasticity: 1_490_000,
          modulus_rupture: 12_300,
          workability: 'easy',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 8.50
        }],
        ['cedar', {
          density: 23,
          hardness: 350,
          modulus_elasticity: 1_120_000,
          modulus_rupture: 7_500,
          workability: 'easy',
          indoor_outdoor: 'both',
          cost_per_board_foot: 5.00
        }],
        ['plywood_birch', {
          density: 42,
          hardness: 0, // N/A for plywood
          modulus_elasticity: 1_900_000,
          modulus_rupture: 8_000,
          workability: 'easy',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 4.00
        }],
        ['mdf', {
          density: 48,
          hardness: 0,
          modulus_elasticity: 350_000,
          modulus_rupture: 4_000,
          workability: 'easy',
          indoor_outdoor: 'indoor',
          cost_per_board_foot: 2.00
        }]
      ]);
    }
  
    /**
     * Initialize span tables for shelf sag calculations
     * Based on 35 lb/ft load and 1/8" deflection limit
     */
    private initializeSpanTables() {
      this.spanTables = {
        '0.75': { // 3/4" thickness
          'pine': 26,
          'oak_red': 30,
          'maple_hard': 32,
          'plywood_birch': 24,
          'mdf': 20,
          'particle_board': 16
        },
        '1': { // 1" thickness
          'pine': 34,
          'oak_red': 40,
          'maple_hard': 42,
          'plywood_birch': 32,
          'mdf': 26,
          'particle_board': 22
        },
        '1.5': { // 1.5" thickness
          'pine': 52,
          'oak_red': 60,
          'maple_hard': 64,
          'plywood_birch': 48,
          'mdf': 40,
          'particle_board': 32
        },
        '2': { // 2" thickness
          'pine': 68,
          'oak_red': 80,
          'maple_hard': 84,
          'plywood_birch': 64,
          'mdf': 52,
          'particle_board': 44
        }
      };
    }
  
    /**
     * Initialize joint strength data
     */
    private initializeJointStrengthTables() {
      this.jointStrengthTable = {
        'mortise_tenon': {
          'pine': { shear: 1200, tension: 800, compression: 2000 },
          'oak_red': { shear: 1800, tension: 1200, compression: 3000 },
          'maple_hard': { shear: 2000, tension: 1400, compression: 3200 }
        },
        'dovetail': {
          'pine': { shear: 1000, tension: 600, compression: 1800 },
          'oak_red': { shear: 1500, tension: 900, compression: 2700 },
          'maple_hard': { shear: 1700, tension: 1000, compression: 2900 }
        },
        'dowel': {
          'pine': { shear: 600, tension: 400, compression: 1000 },
          'oak_red': { shear: 900, tension: 600, compression: 1500 },
          'maple_hard': { shear: 1000, tension: 700, compression: 1700 }
        },
        'pocket_hole': {
          'pine': { shear: 400, tension: 250, compression: 800 },
          'oak_red': { shear: 600, tension: 400, compression: 1200 },
          'maple_hard': { shear: 700, tension: 450, compression: 1300 },
          'plywood_birch': { shear: 500, tension: 300, compression: 900 }
        },
        'biscuit': {
          'pine': { shear: 300, tension: 200, compression: 600 },
          'oak_red': { shear: 450, tension: 300, compression: 900 },
          'plywood_birch': { shear: 400, tension: 250, compression: 800 }
        },
        'screw': {
          'pine': { shear: 200, tension: 150, compression: 400 },
          'oak_red': { shear: 300, tension: 225, compression: 600 },
          'mdf': { shear: 150, tension: 100, compression: 300 }
        }
      };
    }
  
    /**
     * Initialize compatibility rules
     */
    private initializeCompatibilityMatrices() {
      // Material-Joinery compatibility
      this.materialJoineryCompatibility = new Map([
        ['pine', new Set(['mortise_tenon', 'dovetail', 'dowel', 'pocket_hole', 'biscuit', 'screw'])],
        ['oak_red', new Set(['mortise_tenon', 'dovetail', 'dowel', 'pocket_hole', 'biscuit'])],
        ['maple_hard', new Set(['mortise_tenon', 'dovetail', 'dowel', 'pocket_hole'])],
        ['plywood_birch', new Set(['pocket_hole', 'biscuit', 'screw', 'dado', 'rabbet'])],
        ['mdf', new Set(['pocket_hole', 'screw', 'dado', 'rabbet'])]
      ]);
  
      // Tool requirements for joinery
      this.toolRequirements = new Map([
        ['mortise_tenon', new Set(['chisel', 'drill', 'saw', 'marking_gauge'])],
        ['dovetail', new Set(['dovetail_saw', 'chisel', 'marking_gauge'])],
        ['dowel', new Set(['drill', 'dowel_centers', 'saw'])],
        ['pocket_hole', new Set(['pocket_hole_jig', 'drill'])],
        ['biscuit', new Set(['biscuit_joiner', 'clamps'])],
        ['dado', new Set(['table_saw', 'router'])],
        ['rabbet', new Set(['table_saw', 'router'])],
        ['screw', new Set(['drill', 'screwdriver'])]
      ]);
    }
  
    /**
     * Initialize furniture design templates
     */
    private initializeFurnitureTemplates() {
      this.furnitureTemplates = new Map([
        ['bookshelf', {
          standard_dimensions: { width: 32, height: 72, depth: 12 },
          shelf_spacing: { min: 9, max: 16, typical: 12 },
          material_thickness: { shelves: 0.75, sides: 0.75, back: 0.25 },
          typical_joints: ['dado', 'screw', 'dowel'],
          load_per_shelf: 40, // pounds
          features: ['adjustable_shelves', 'back_panel', 'anti_tip']
        }],
        ['table', {
          standard_dimensions: { 
            dining: { width: 36, length: 72, height: 30 },
            coffee: { width: 24, length: 48, height: 17 },
            end: { width: 20, length: 20, height: 24 }
          },
          apron_setback: 3,
          leg_thickness: { min: 2, typical: 3 },
          typical_joints: ['mortise_tenon', 'dowel', 'pocket_hole'],
          features: ['leaves', 'drawers', 'lower_shelf']
        }],
        ['chair', {
          standard_dimensions: { 
            seat: { width: 18, depth: 16, height: 17 },
            back: { height_above_seat: 18, angle: 10 } // degrees
          },
          typical_joints: ['mortise_tenon', 'dowel'],
          load_capacity: 300, // pounds
          features: ['arms', 'cushion', 'rockers']
        }],
        ['nightstand', {
          standard_dimensions: { width: 20, height: 26, depth: 16 },
          drawer_height: { min: 4, max: 8 },
          typical_joints: ['dovetail', 'pocket_hole', 'biscuit'],
          features: ['drawer', 'shelf', 'cable_management']
        }]
      ]);
    }
  
    /**
     * Build the knowledge graph nodes and relationships
     */
    private buildKnowledgeGraph() {
      // Create material nodes
      for (const [materialId, props] of this.materialProperties) {
        this.nodes.set(materialId, {
          id: materialId,
          type: 'material',
          name: materialId.replace('_', ' '),
          properties: props,
          relationships: []
        });
      }
  
      // Create joinery nodes
      for (const jointType of Object.keys(this.jointStrengthTable)) {
        this.nodes.set(jointType, {
          id: jointType,
          type: 'joinery',
          name: jointType.replace('_', ' '),
          properties: this.jointStrengthTable[jointType],
          relationships: []
        });
      }
  
      // Build relationships
      this.buildMaterialJoineryRelationships();
      this.buildStrengthRelationships();
    }
  
    private buildMaterialJoineryRelationships() {
      for (const [material, joints] of this.materialJoineryCompatibility) {
        const materialNode = this.nodes.get(material);
        if (!materialNode) continue;
  
        for (const joint of joints) {
          const jointNode = this.nodes.get(joint);
          if (!jointNode) continue;
  
          // Material -> Joint relationship
          materialNode.relationships.push({
            type: 'compatible_with',
            target_id: joint,
            strength: 1.0,
            metadata: { reason: 'proven_compatibility' }
          });
  
          // Joint -> Material relationship
          jointNode.relationships.push({
            type: 'compatible_with',
            target_id: material,
            strength: 1.0,
            metadata: { reason: 'proven_compatibility' }
          });
        }
      }
    }
  
    private buildStrengthRelationships() {
      // Add strength-based relationships between joints
      const joints = Array.from(this.nodes.values()).filter(n => n.type === 'joinery');
      
      for (let i = 0; i < joints.length; i++) {
        for (let j = i + 1; j < joints.length; j++) {
          const joint1 = joints[i];
          const joint2 = joints[j];
          
          // Compare average strength
          const strength1 = this.getAverageJointStrength(joint1.id);
          const strength2 = this.getAverageJointStrength(joint2.id);
          
          if (Math.abs(strength1 - strength2) / Math.max(strength1, strength2) < 0.2) {
            // Similar strength - alternatives
            joint1.relationships.push({
              type: 'alternative_to',
              target_id: joint2.id,
              strength: 0.8,
              metadata: { reason: 'similar_strength' }
            });
            joint2.relationships.push({
              type: 'alternative_to',
              target_id: joint1.id,
              strength: 0.8,
              metadata: { reason: 'similar_strength' }
            });
          }
        }
      }
    }
  
    // ========== Public API Methods ==========
  
    /**
     * Get maximum span for given material and thickness
     */
    getMaxSpan(material: string, thickness: number): number {
      const thicknessKey = thickness.toString();
      const spanTable = this.spanTables[thicknessKey];
      
      if (!spanTable) {
        // Interpolate if thickness not in table
        const thicknesses = Object.keys(this.spanTables)
          .map(t => parseFloat(t))
          .sort((a, b) => a - b);
        
        // Find surrounding thicknesses
        let lower = thicknesses[0];
        let upper = thicknesses[thicknesses.length - 1];
        
        for (let i = 0; i < thicknesses.length - 1; i++) {
          if (thickness >= thicknesses[i] && thickness <= thicknesses[i + 1]) {
            lower = thicknesses[i];
            upper = thicknesses[i + 1];
            break;
          }
        }
        
        // Linear interpolation
        const lowerSpan = this.spanTables[lower.toString()][material] || 24;
        const upperSpan = this.spanTables[upper.toString()][material] || 36;
        const ratio = (thickness - lower) / (upper - lower);
        
        return lowerSpan + (upperSpan - lowerSpan) * ratio;
      }
      
      return spanTable[material] || 24; // Default conservative span
    }
  
    /**
     * Calculate minimum thickness needed for a span
     */
    getMinThickness(material: string, span: number): number {
      for (const [thickness, spanTable] of Object.entries(this.spanTables)) {
        const maxSpan = spanTable[material];
        if (maxSpan && maxSpan >= span) {
          return parseFloat(thickness);
        }
      }
      return 2.0; // Maximum thickness if span too large
    }
  
    /**
     * Get compatible joinery methods for material
     */
    getCompatibleJoinery(material: string): JoineryType[] {
      const joints = this.materialJoineryCompatibility.get(material);
      return joints ? Array.from(joints) as JoineryType[] : ['screw'];
    }
  
    /**
     * Get required tools for joinery method
     */
    getRequiredTools(joinery: JoineryType): string[] {
      const tools = this.toolRequirements.get(joinery);
      return tools ? Array.from(tools) : ['drill', 'saw'];
    }
  
    /**
     * Calculate joint strength
     */
    getJointStrength(
      jointType: JoineryType, 
      material: string,
      loadType: 'shear' | 'tension' | 'compression' = 'shear'
    ): number {
      const jointData = this.jointStrengthTable[jointType];
      if (!jointData) return 100; // Conservative default
      
      const materialData = jointData[material];
      if (!materialData) {
        // Use pine as default if material not found
        return jointData['pine']?.[loadType] || 100;
      }
      
      return materialData[loadType];
    }
  
    /**
     * Get furniture template
     */
    getFurnitureTemplate(type: FurnitureType): any {
      return this.furnitureTemplates.get(type) || {
        standard_dimensions: { width: 24, height: 30, depth: 18 },
        typical_joints: ['screw', 'dowel']
      };
    }
  
    /**
     * Validate material choice for application
     */
    validateMaterial(
      material: string, 
      requirements: {
        span?: number;
        thickness?: number;
        environment?: 'indoor' | 'outdoor';
        load?: number;
      }
    ): ValidationResult {
      const issues: any[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];
      let score = 1.0;
      
      const props = this.materialProperties.get(material);
      if (!props) {
        return {
          valid: false,
          score: 0,
          issues: [{ 
            type: 'unknown_material', 
            severity: 'critical', 
            message: `Unknown material: ${material}`,
            affected_component: 'material',
            fix_available: false
          }],
          warnings: [],
          suggestions: ['Use a known material like pine, oak, or plywood']
        };
      }
      
      // Check span requirements
      if (requirements.span && requirements.thickness) {
        const maxSpan = this.getMaxSpan(material, requirements.thickness);
        if (requirements.span > maxSpan) {
          score *= 0.5;
          issues.push({
            type: 'excessive_span',
            severity: 'high',
            message: `${requirements.span}" span exceeds maximum ${maxSpan}" for ${requirements.thickness}" ${material}`,
            affected_component: 'structure',
            fix_available: true
          });
          suggestions.push(
            `Reduce span to ${maxSpan}"`,
            `Use thicker material (${this.getMinThickness(material, requirements.span)}")`,
            'Add center support'
          );
        }
      }
      
      // Check environment compatibility
      if (requirements.environment === 'outdoor' && props.indoor_outdoor === 'indoor') {
        score *= 0.7;
        warnings.push(`${material} is not recommended for outdoor use`);
        suggestions.push('Consider cedar, teak, or treated lumber for outdoor projects');
      }
      
      // Check load capacity
      if (requirements.load && requirements.thickness) {
        const stress = requirements.load / (requirements.thickness * 12); // Simplified
        if (stress > props.modulus_rupture * 0.4) { // 40% safety margin
          score *= 0.6;
          warnings.push('Material may be stressed beyond safe limits');
          suggestions.push('Use stronger material or increase thickness');
        }
      }
      
      return {
        valid: issues.filter(i => i.severity === 'critical').length === 0,
        score,
        issues,
        warnings,
        suggestions
      };
    }
  
    /**
     * Suggest alternative materials
     */
    suggestAlternatives(
      currentMaterial: string,
      criteria: {
        maxCost?: number;
        minStrength?: number;
        environment?: 'indoor' | 'outdoor';
        workability?: 'easy' | 'moderate' | 'difficult';
      }
    ): Array<{ material: string; score: number; reason: string }> {
      const alternatives: Array<{ material: string; score: number; reason: string }> = [];
      
      for (const [materialId, props] of this.materialProperties) {
        if (materialId === currentMaterial) continue;
        
        let score = 1.0;
        let reasons: string[] = [];
        
        // Cost criteria
        if (criteria.maxCost && props.cost_per_board_foot > criteria.maxCost) {
          continue; // Skip if too expensive
        }
        
        // Strength criteria
        if (criteria.minStrength && props.modulus_rupture < criteria.minStrength) {
          continue; // Skip if too weak
        }
        
        // Environment criteria
        if (criteria.environment && 
            criteria.environment === 'outdoor' && 
            props.indoor_outdoor === 'indoor') {
          continue; // Skip indoor-only materials for outdoor use
        }
        
        // Workability criteria
        if (criteria.workability === 'easy' && props.workability === 'difficult') {
          score *= 0.5;
          reasons.push('harder to work with');
        }
        
        // Bonus for better properties
        const currentProps = this.materialProperties.get(currentMaterial);
        if (currentProps) {
          if (props.modulus_rupture > currentProps.modulus_rupture) {
            score *= 1.2;
            reasons.push('stronger');
          }
          if (props.cost_per_board_foot < currentProps.cost_per_board_foot) {
            score *= 1.1;
            reasons.push('more affordable');
          }
        }
        
        alternatives.push({
          material: materialId,
          score,
          reason: reasons.join(', ') || 'suitable alternative'
        });
      }
      
      // Sort by score
      alternatives.sort((a, b) => b.score - a.score);
      
      return alternatives.slice(0, 3); // Top 3 alternatives
    }
  
    /**
     * Get wood movement calculations
     */
    calculateWoodMovement(
      species: string,
      width: number,
      moistureChange: number = 6 // Default 6% moisture change
    ): { tangential: number; radial: number } {
      // Wood movement coefficients (simplified)
      const movementCoefficients = {
        pine: { tangential: 0.00263, radial: 0.00148 },
        oak_red: { tangential: 0.00369, radial: 0.00183 },
        maple_hard: { tangential: 0.00353, radial: 0.00165 },
        walnut: { tangential: 0.00274, radial: 0.00190 },
        cherry: { tangential: 0.00258, radial: 0.00126 }
      };
      
      const coefficients = movementCoefficients[species] || movementCoefficients.pine;
      
      return {
        tangential: width * coefficients.tangential * moistureChange,
        radial: width * coefficients.radial * moistureChange
      };
    }
  
    // ========== Helper Methods ==========
  
    private getAverageJointStrength(jointType: string): number {
      const jointData = this.jointStrengthTable[jointType];
      if (!jointData) return 0;
      
      let total = 0;
      let count = 0;
      
      for (const material of Object.values(jointData)) {
        total += material.shear + material.tension + material.compression;
        count += 3;
      }
      
      return count > 0 ? total / count : 0;
    }
  
    /**
     * Export knowledge graph for visualization
     */
    exportGraph(): { nodes: any[]; edges: any[] } {
      const nodes = Array.from(this.nodes.values()).map(node => ({
        id: node.id,
        label: node.name,
        type: node.type,
        properties: node.properties
      }));
      
      const edges: any[] = [];
      for (const node of this.nodes.values()) {
        for (const rel of node.relationships) {
          edges.push({
            source: node.id,
            target: rel.target_id,
            type: rel.type,
            weight: rel.strength
          });
        }
      }
      
      return { nodes, edges };
    }
  }
  
  // Export singleton instance
  export const knowledgeGraph = new FurnitureKnowledgeGraph();