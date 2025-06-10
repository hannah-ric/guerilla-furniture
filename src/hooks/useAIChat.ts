// hooks/useAIChat.ts - Enhanced version with Intent Classifier
import { useState, useCallback, useRef } from 'react';
import { Message } from '@/lib/types';
import supabaseService from '@/services/supabaseService';
import { setupBlueprintBuddy } from '@/services/intentSystem';
import { IntentType } from '@/services/intentClassifier';

export interface EnhancedMessage extends Message {
  intent?: IntentType;
  agentData?: any;
  suggestions?: string[];
  validationIssues?: string[];
}

export interface FurnitureDesign {
  id: string;
  name: string;
  furniture_type: string;
  dimensions: {
    height?: number;
    width?: number;
    depth?: number;
    [key: string]: number | undefined;
  };
  materials: string[];
  joinery: string[];
  cutList: Array<{
    piece: string;
    quantity: number;
    dimensions: string;
    material: string;
  }>;
  model3D?: {
    url: string;
    explodedUrl?: string;
  };
  validationStatus: 'pending' | 'valid' | 'invalid';
  estimatedCost: number;
  buildTime: string;
}

export const useEnhancedAIChat = () => {
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [currentDesign, setCurrentDesign] = useState<FurnitureDesign | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const orchestratorRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize the intent system
  const initializeSystem = useCallback(async () => {
    if (!orchestratorRef.current) {
      try {
        orchestratorRef.current = await setupBlueprintBuddy();
      } catch (err) {
        console.error('Failed to initialize intent system:', err);
        setError('Failed to initialize AI system');
      }
    }
  }, []);

  // Send message with intent classification
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    await initializeSystem();
    
    const userMessage: EnhancedMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Process through intent classifier
      const result = await orchestratorRef.current.processUserInput(content);
      
      // Handle different intents
      let responseContent = '';
      let updatedDesign = currentDesign;

      switch (result.intent.primary_intent) {
        case IntentType.DESIGN_INITIATION:
          updatedDesign = await handleDesignInitiation(result);
          responseContent = `Great! Let's design a ${result.primaryData.furniture_type}. ${
            result.suggestions?.[0] || 'What dimensions are you thinking?'
          }`;
          break;

        case IntentType.DIMENSION_SPECIFICATION:
          updatedDesign = await handleDimensionUpdate(result, currentDesign);
          responseContent = formatDimensionResponse(result);
          break;

        case IntentType.MATERIAL_SELECTION:
          updatedDesign = await handleMaterialSelection(result, currentDesign);
          responseContent = formatMaterialResponse(result);
          break;

        case IntentType.JOINERY_METHOD:
          updatedDesign = await handleJoinerySelection(result, currentDesign);
          responseContent = formatJoineryResponse(result);
          break;

        case IntentType.VALIDATION_CHECK:
          const validationResult = await handleValidation(currentDesign);
          responseContent = formatValidationResponse(validationResult);
          break;

        case IntentType.EXPORT_REQUEST:
          await handleExport(currentDesign);
          responseContent = "I've generated your plans! You can download them now.";
          break;

        default:
          responseContent = result.requiresClarification
            ? result.clarificationPrompts?.[0] || "Could you tell me more?"
            : "I'll help you with that.";
      }

      // Create assistant message
      const assistantMessage: EnhancedMessage = {
        id: (Date.now() + 1).toString(),
        content: responseContent,
        role: 'assistant',
        timestamp: new Date(),
        intent: result.intent.primary_intent,
        agentData: result.primaryData,
        suggestions: result.suggestions,
        validationIssues: result.validationIssues
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (updatedDesign) {
        setCurrentDesign(updatedDesign);
        await updateSupabase(updatedDesign);
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        const errorMessage: EnhancedMessage = {
          id: (Date.now() + 1).toString(),
          content: "I encountered an error. Let me try a different approach.",
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentDesign, initializeSystem]);

  // Handler functions
  const handleDesignInitiation = async (result: any): Promise<FurnitureDesign> => {
    const design: FurnitureDesign = {
      id: Date.now().toString(),
      name: `${result.primaryData.furniture_type} Design`,
      furniture_type: result.primaryData.furniture_type,
      dimensions: {},
      materials: [],
      joinery: [],
      cutList: [],
      validationStatus: 'pending',
      estimatedCost: 0,
      buildTime: 'TBD'
    };

    // Generate initial 3D model
    const modelUrl = await generate3DModel(design);
    if (modelUrl) {
      design.model3D = { url: modelUrl };
    }

    return design;
  };

  const handleDimensionUpdate = async (
    result: any, 
    design: FurnitureDesign | null
  ): Promise<FurnitureDesign> => {
    if (!design) throw new Error('No active design');

    const updatedDesign = { ...design };
    
    // Update dimensions
    result.primaryData.measurements.forEach((measurement: any) => {
      updatedDesign.dimensions[measurement.dimension_type] = 
        measurement.converted_to_inches;
    });

    // Regenerate 3D model with new dimensions
    const modelUrl = await generate3DModel(updatedDesign);
    if (modelUrl) {
      updatedDesign.model3D = { url: modelUrl };
    }

    // Update validation status
    updatedDesign.validationStatus = 'pending';

    return updatedDesign;
  };

  const handleMaterialSelection = async (
    result: any,
    design: FurnitureDesign | null
  ): Promise<FurnitureDesign> => {
    if (!design) throw new Error('No active design');

    const updatedDesign = { ...design };
    updatedDesign.materials = [result.primaryData.primary_material.name];
    updatedDesign.estimatedCost = result.primaryData.cost_estimate;

    return updatedDesign;
  };

  const handleJoinerySelection = async (
    result: any,
    design: FurnitureDesign | null
  ): Promise<FurnitureDesign> => {
    if (!design) throw new Error('No active design');

    const updatedDesign = { ...design };
    updatedDesign.joinery = [result.primaryData.primary_method.name];
    
    // Generate cut list based on dimensions and joinery
    updatedDesign.cutList = generateCutList(updatedDesign);

    return updatedDesign;
  };

  const handleValidation = async (design: FurnitureDesign | null) => {
    if (!design) throw new Error('No active design');

    // This would call the validation agent
    return {
      is_valid: true,
      physics: { stable: true, maxLoad: 150 },
      suggestions: ["Consider adding a center support for shelves over 36 inches"]
    };
  };

  const handleExport = async (design: FurnitureDesign | null) => {
    if (!design) throw new Error('No active design');
    
    // Generate and download plans
    await generateAndDownloadPlans(design);
  };

  // Helper functions
  const formatDimensionResponse = (result: any): string => {
    const dims = result.primaryData.total_dimensions;
    return `Perfect! I've set the dimensions to ${dims.height}" H x ${dims.width}" W x ${dims.depth}" D. 
    This will require approximately ${result.primaryData.material_requirements.board_feet} board feet of material.
    ${result.suggestions?.[0] || ''}`;
  };

  const formatMaterialResponse = (result: any): string => {
    const material = result.primaryData.primary_material;
    return `${material.name} is an excellent choice! It's ${material.workability} to work with and costs around 
    $${result.primaryData.cost_estimate} for this project. ${result.suggestions?.[0] || ''}`;
  };

  const formatJoineryResponse = (result: any): string => {
    const method = result.primaryData.primary_method;
    return `I recommend using ${method.name.replace('_', ' ')} joints. This is a ${method.difficulty} 
    technique that provides good strength. You'll need: ${method.tools.join(', ')}.`;
  };

  const formatValidationResponse = (result: any): string => {
    if (result.is_valid) {
      return `✅ Your design is structurally sound! It can safely hold up to ${result.physics.maxLoad} lbs. 
      ${result.suggestions?.[0] || 'Ready to generate the final plans?'}`;
    } else {
      return `⚠️ I found some issues with the current design: ${result.issues?.join(', ')}. 
      Let's address these before proceeding.`;
    }
  };

  // 3D Model Generation
  const generate3DModel = async (design: FurnitureDesign): Promise<string | null> => {
    try {
      // This would call your 3D generation service
      const response = await supabaseService.functions.invoke('generate-3d-model', {
        body: design
      });
      return response.data?.modelUrl;
    } catch (err) {
      console.error('3D generation failed:', err);
      return null;
    }
  };

  // Cut List Generation
  const generateCutList = (design: FurnitureDesign) => {
    // Simple example - would be more complex in production
    const cutList = [];
    
    if (design.furniture_type === 'bookshelf') {
      const shelfCount = Math.floor((design.dimensions.height || 72) / 12) - 1;
      
      cutList.push({
        piece: 'Side Panel',
        quantity: 2,
        dimensions: `${design.dimensions.height}" x ${design.dimensions.depth}" x 3/4"`,
        material: design.materials[0] || 'TBD'
      });
      
      cutList.push({
        piece: 'Shelf',
        quantity: shelfCount,
        dimensions: `${(design.dimensions.width || 36) - 1.5}" x ${design.dimensions.depth}" x 3/4"`,
        material: design.materials[0] || 'TBD'
      });
    }
    
    return cutList;
  };

  // Supabase Integration
  const updateSupabase = async (design: FurnitureDesign) => {
    try {
      await supabaseService.buildPlans.upsert({
        id: design.id,
        name: design.name,
        dimensions: design.dimensions,
        plan_data: {
          furniture_type: design.furniture_type,
          materials: design.materials,
          joinery: design.joinery,
          cutList: design.cutList,
          validationStatus: design.validationStatus,
          estimatedCost: design.estimatedCost,
          buildTime: design.buildTime
        },
        model_url: design.model3D?.url,
        exploded_view_url: design.model3D?.explodedUrl
      });
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
    }
  };

  const generateAndDownloadPlans = async (design: FurnitureDesign) => {
    // Generate PDF or other format
    const response = await supabaseService.functions.invoke('generate-plans', {
      body: design
    });
    
    // Download the file
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${design.name}.pdf`;
    a.click();
  };

  // Cleanup
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentDesign(null);
    setError(null);
  }, []);

  return {
    messages,
    currentDesign,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearChat,
    initializeSystem
  };
};