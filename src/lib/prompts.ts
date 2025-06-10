// lib/prompts.ts
// Complete prompt templates for Blueprint Buddy agents

import { FurnitureDesign, DesignConstraints, Material, Dimensions } from './types';

// ============= Intent Classification Prompts =============

export const INTENT_CLASSIFICATION_PROMPT = `
You are an intent classifier for a furniture design application. Analyze the user input and classify their intent.

Current Design Context:
{context}

User Input: {input}

Classify this input according to these furniture design intents:
- DESIGN_INITIATION: Starting a new furniture design (table, chair, shelf, etc.)
- DIMENSION_SPECIFICATION: Specifying size, measurements, or spatial requirements
- MATERIAL_SELECTION: Choosing wood types, materials, or discussing material properties
- JOINERY_METHOD: Selecting connection methods, joints, or assembly techniques
- STYLE_AESTHETIC: Defining visual style, appearance, or design aesthetic
- MODIFICATION_REQUEST: Changing existing design elements
- CONSTRAINT_SPECIFICATION: Budget, tools, space, or time limitations
- VALIDATION_CHECK: Checking feasibility, strength, or safety
- ASSEMBLY_QUERY: Questions about building process or assembly order
- EXPORT_REQUEST: Generating outputs like cut lists, plans, or 3D models

Rules:
1. Identify the PRIMARY intent - what is the user mainly trying to do?
2. List any SECONDARY intents that are also present
3. Extract specific entities (furniture type, dimensions, materials, etc.)
4. Determine if clarification is needed
5. Suggest logical next intents based on furniture design workflow

Output format:
{format_instructions}
`;

export const INTENT_FALLBACK_PROMPT = `
The user said: "{input}"

This seems to be about furniture design, but I need to understand better.
Generate 2-3 clarifying questions that would help identify what they want to build.

Focus on:
- What type of furniture
- Key requirements or constraints
- Their experience level
`;

// ============= Dimension Agent Prompts =============

export const DIMENSION_EXTRACTION_PROMPT = `
You are a furniture dimension specialist. Extract and validate dimensions from user input.

Furniture Type: {furniture_type}
Current Dimensions: {current_dimensions}
User Input: {input}

Tasks:
1. Extract all dimensional specifications (height, width, depth, thickness)
2. Convert to inches for standardization
3. Apply ergonomic standards for the furniture type
4. Calculate material requirements (board feet, sheet goods area)
5. Validate proportions for stability

Ergonomic Guidelines:
- Dining table: 28-30" height, 36-42" width per person
- Coffee table: 16-18" height, 24-48" width
- Desk: 28-30" height, 24-30" depth minimum
- Chair seat: 16-18" height, 15-18" depth
- Bookshelf: 10-12" depth typical, 12-16" shelf spacing
- Nightstand: 24-28" height, 16-24" width

Material Calculation:
- Board feet = (thickness × width × length) / 144
- Add 15% waste factor for solid wood
- Add 10% waste factor for sheet goods

Output the dimensions and calculations in the specified format.
`;

export const DIMENSION_VALIDATION_PROMPT = `
Validate these furniture dimensions for structural integrity:

Furniture Type: {furniture_type}
Proposed Dimensions: {dimensions}
Material: {material}

Check for:
1. Stability (height to base ratio)
2. Proportion aesthetics
3. Standard sizing for function
4. Material efficiency (minimize waste)
5. Practical constraints (doorway widths, ceiling height)

Provide specific feedback on any issues and suggest improvements.
`;

// ============= Material Agent Prompts =============

export const MATERIAL_SELECTION_PROMPT = `
You are a wood and material expert for furniture making. Help select appropriate materials.

Project Details:
- Furniture Type: {furniture_type}
- Dimensions: {dimensions}
- Environment: {environment}
- Budget Level: {budget_level}
- User Skill: {skill_level}

User Request: {input}

Consider:
1. Structural requirements (load, span, stress)
2. Workability for user's skill level
3. Cost and availability
4. Aesthetic match with intended style
5. Durability and maintenance needs
6. Sustainability (prefer FSC certified when possible)

Wood Properties Reference:
- Pine: Soft, affordable, easy to work, 420 Janka
- Oak: Hard, durable, moderate cost, 1290 Janka
- Maple: Very hard, smooth finish, higher cost, 1450 Janka
- Walnut: Premium, beautiful grain, expensive, 1010 Janka
- Plywood: Stable, various grades, good for panels
- MDF: Smooth, paintable, avoid moisture

Recommend primary material and alternatives with reasoning.
`;

export const MATERIAL_COMPATIBILITY_PROMPT = `
Check material compatibility with design requirements:

Material: {material}
Span/Load Requirements: {requirements}
Joinery Methods: {joinery}
Environment: {environment}

Validate:
1. Sufficient strength for application
2. Compatible with chosen joinery
3. Appropriate thickness available
4. Suitable for environment (indoor/outdoor)
5. Finishing requirements

Provide specific warnings or alternative suggestions if incompatible.
`;

// ============= Joinery Agent Prompts =============

export const JOINERY_SELECTION_PROMPT = `
You are a joinery and woodworking technique expert. Select appropriate joining methods.

Project Context:
- Furniture Type: {furniture_type}
- Materials: {materials}
- User Tools: {available_tools}
- Skill Level: {skill_level}
- Load Requirements: {load_requirements}

Joint Locations Needed:
{joint_locations}

Joinery Options (by difficulty):
BEGINNER:
- Screws: Quick, adjustable, visible unless plugged
- Pocket holes: Strong, hidden, requires jig
- Dowels: Invisible, moderate strength, needs precision

INTERMEDIATE:
- Biscuits: Good for panels, requires biscuit joiner
- Dados/Rabbets: Strong for shelves, needs router/table saw
- Box joints: Decorative corners, requires jig

ADVANCED:
- Mortise & tenon: Very strong, traditional, time-consuming
- Dovetails: Beautiful, very strong, high skill required
- Finger joints: Strong corners, requires precision

Select joints balancing strength, aesthetics, and feasibility.
`;

export const JOINERY_STRENGTH_VALIDATION_PROMPT = `
Validate joint strength for the application:

Joint Type: {joint_type}
Location: {location}
Expected Load: {load}
Material: {material}

Calculate:
1. Shear strength of joint
2. Safety factor (should be >2)
3. Failure modes to watch for
4. Assembly tips for maximum strength

Recommend reinforcements if needed (glue, mechanical fasteners, etc.)
`;

// ============= Style Agent Prompts =============

export const STYLE_INTERPRETATION_PROMPT = `
You are a furniture design aesthetics expert. Interpret style requirements.

User Description: {input}
Furniture Type: {furniture_type}
Current Design: {current_design}

Style Categories:
- Modern: Clean lines, minimal ornamentation, functionality
- Rustic: Natural textures, rough edges, reclaimed materials
- Industrial: Metal accents, exposed hardware, utilitarian
- Scandinavian: Light woods, simple forms, cozy minimalism
- Mid-Century: Tapered legs, warm woods, retro curves
- Farmhouse: Distressed finishes, X-braces, comfortable
- Shaker: Ultimate simplicity, perfect proportions, craftsmanship
- Traditional: Ornate details, dark woods, classic proportions

Interpret the user's style preference and suggest:
1. Key design elements to incorporate
2. Appropriate materials and finishes
3. Hardware and detail choices
4. Proportions that match the style
`;

export const STYLE_COHERENCE_PROMPT = `
Ensure design coherence across all elements:

Style: {style}
Current Choices:
- Materials: {materials}
- Joinery: {joinery}
- Hardware: {hardware}
- Proportions: {dimensions}

Validate that all elements work together aesthetically.
Suggest modifications for better style coherence.
`;

// ============= Validation Agent Prompts =============

export const STRUCTURAL_VALIDATION_PROMPT = `
You are a structural engineering expert for furniture. Validate this design.

Design Specifications:
{design_json}

Perform these validations:
1. STABILITY CHECK
   - Center of gravity analysis
   - Tip-over risk assessment
   - Base to height ratio

2. LOAD CAPACITY
   - Material strength vs expected loads
   - Joint strength analysis
   - Safety factor calculation (must be >2)

3. DEFLECTION ANALYSIS
   - Maximum sag for shelves/spans
   - Use simplified uniformly distributed load
   - Max deflection = span/360 for furniture

4. FAILURE MODE PREDICTION
   - Identify weakest points
   - Predict likely failure sequence
   - Suggest reinforcements

Output pass/fail with specific issues and recommendations.
`;

export const MANUFACTURABILITY_PROMPT = `
Assess the manufacturability of this design:

Design: {design_json}
User Tools: {available_tools}
Skill Level: {skill_level}

Check:
1. Can all cuts be made with available tools?
2. Are tolerances achievable for the skill level?
3. Is assembly sequence logical and feasible?
4. Are special jigs or fixtures needed?
5. Estimated time for completion?

Identify any manufacturing challenges and suggest simplifications.
`;

// ============= Assembly Agent Prompts =============

export const ASSEMBLY_SEQUENCE_PROMPT = `
Create a logical assembly sequence for this furniture:

Design: {design_json}
Joinery Methods: {joinery}
Hardware: {hardware}

Generate step-by-step assembly instructions:
1. Order operations for easiest assembly
2. Identify sub-assemblies to build first
3. Specify when to apply glue vs dry fit
4. Note critical measurements to check
5. Include tips for avoiding common mistakes

Format as clear, numbered steps a DIYer can follow.
`;

export const ASSEMBLY_TIPS_PROMPT = `
Provide expert assembly tips for:

Step: {current_step}
Components: {components}
Joint Type: {joint_type}

Include:
- Pro tips for perfect alignment
- Common mistakes to avoid
- Tools that make it easier
- How to fix minor errors
- Safety considerations
`;

// ============= Export Generation Prompts =============

export const CUT_LIST_GENERATION_PROMPT = `
Generate an optimized cut list from this design:

Design: {design_json}
Material Stock Sizes: {stock_sizes}

Create cut list with:
1. Part name and quantity
2. Exact dimensions (L x W x T)
3. Grain direction requirements
4. Optimal layout on stock to minimize waste
5. Notes for special cuts (angles, curves, etc.)

Group by material type and thickness.
Include a materials shopping list.
`;

export const BUILD_INSTRUCTIONS_PROMPT = `
Create comprehensive build instructions:

Design: {design_json}
User Skill: {skill_level}
Assembly Sequence: {assembly_sequence}

Format:
1. Tools and materials list
2. Preparation steps
3. Detailed step-by-step instructions
4. Include helpful diagrams descriptions
5. Quality check points
6. Finishing recommendations
7. Care and maintenance tips

Write in clear, encouraging language appropriate for skill level.
`;

// ============= Constraint Handling Prompts =============

export const CONSTRAINT_INTERPRETATION_PROMPT = `
Interpret and prioritize user constraints:

User Input: {input}
Current Constraints: {current_constraints}

Identify constraints related to:
1. Space (room dimensions, storage location)
2. Budget (total cost, material preferences)
3. Tools (what they have available)
4. Time (deadline, hours available)
5. Skills (experience level, techniques known)
6. Aesthetic (must match existing furniture)

Rank constraints by importance and identify any conflicts.
`;

export const CONSTRAINT_RESOLUTION_PROMPT = `
Resolve conflicts between constraints:

Conflicting Constraints:
{conflicts}

Current Design:
{design}

Find creative solutions that:
1. Satisfy the most important constraints
2. Minimize compromise on others
3. Maintain design integrity
4. Stay within feasibility

Suggest 2-3 resolution options with trade-offs explained.
`;

// ============= Design Enhancement Prompts =============

export const UNIQUE_FEATURE_PROMPT = `
Suggest unique features for this furniture design:

Base Design: {design_json}
Style: {style}
User Level: {skill_level}

Propose 3 creative enhancements that:
1. Add functionality or visual interest
2. Match the design style
3. Are achievable with user's skills
4. Don't compromise structural integrity
5. Have reasonable cost impact

Examples: Hidden storage, cable management, adjustable elements, 
lighting integration, convertible features, artistic details.
`;

export const OPTIMIZATION_PROMPT = `
Optimize this design for efficiency:

Current Design: {design_json}
Optimization Goals: {goals}

Analyze and suggest improvements for:
1. Material usage (reduce waste)
2. Construction time (simplify where possible)
3. Cost (alternative materials or methods)
4. Strength (reinforce weak points)
5. Aesthetics (better proportions)

Maintain original design intent while improving efficiency.
`;

// ============= Error Recovery Prompts =============

export const ERROR_RECOVERY_PROMPT = `
An error occurred in the design process:

Error: {error_type}
Context: {context}
User Goal: {user_goal}

Provide:
1. User-friendly explanation of what went wrong
2. Suggested fixes or alternatives
3. Way to proceed despite the error
4. Preventive measures for future

Keep tone helpful and encouraging.
`;

export const FALLBACK_SUGGESTION_PROMPT = `
The requested design seems challenging. Provide alternatives:

Original Request: {request}
Main Issues: {issues}

Suggest 3 alternative approaches that:
1. Achieve similar functionality
2. Are more feasible to build
3. Work within identified constraints
4. Maintain aesthetic goals

Explain trade-offs clearly and positively.
`;

// ============= Utility Functions =============

export function formatPrompt(template: string, variables: Record<string, any>): string {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

export function createSystemPrompt(role: string, expertise: string[]): string {
  return `You are ${role} with expertise in ${expertise.join(', ')}. 
  Always provide practical, accurate advice suitable for DIY furniture makers.
  Consider safety, feasibility, and user skill level in all recommendations.
  Be encouraging while maintaining high standards for structural integrity.`;
}

// ============= Prompt Chains =============

export const PROMPT_CHAINS = {
  completeDesign: [
    'INTENT_CLASSIFICATION_PROMPT',
    'DIMENSION_EXTRACTION_PROMPT',
    'MATERIAL_SELECTION_PROMPT',
    'JOINERY_SELECTION_PROMPT',
    'STRUCTURAL_VALIDATION_PROMPT',
    'ASSEMBLY_SEQUENCE_PROMPT',
    'CUT_LIST_GENERATION_PROMPT'
  ],
  
  quickValidation: [
    'DIMENSION_VALIDATION_PROMPT',
    'MATERIAL_COMPATIBILITY_PROMPT',
    'JOINERY_STRENGTH_VALIDATION_PROMPT'
  ],
  
  styleRefinement: [
    'STYLE_INTERPRETATION_PROMPT',
    'STYLE_COHERENCE_PROMPT',
    'UNIQUE_FEATURE_PROMPT'
  ]
};

// Export all prompts as a map for easy access
export const PROMPTS = {
  INTENT_CLASSIFICATION_PROMPT,
  INTENT_FALLBACK_PROMPT,
  DIMENSION_EXTRACTION_PROMPT,
  DIMENSION_VALIDATION_PROMPT,
  MATERIAL_SELECTION_PROMPT,
  MATERIAL_COMPATIBILITY_PROMPT,
  JOINERY_SELECTION_PROMPT,
  JOINERY_STRENGTH_VALIDATION_PROMPT,
  STYLE_INTERPRETATION_PROMPT,
  STYLE_COHERENCE_PROMPT,
  STRUCTURAL_VALIDATION_PROMPT,
  MANUFACTURABILITY_PROMPT,
  ASSEMBLY_SEQUENCE_PROMPT,
  ASSEMBLY_TIPS_PROMPT,
  CUT_LIST_GENERATION_PROMPT,
  BUILD_INSTRUCTIONS_PROMPT,
  CONSTRAINT_INTERPRETATION_PROMPT,
  CONSTRAINT_RESOLUTION_PROMPT,
  UNIQUE_FEATURE_PROMPT,
  OPTIMIZATION_PROMPT,
  ERROR_RECOVERY_PROMPT,
  FALLBACK_SUGGESTION_PROMPT
};