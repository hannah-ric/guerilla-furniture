import { useState, useEffect, useCallback } from 'react';
import { orchestrator } from '@/services/orchestrator';
import { useSharedState } from '@/services/state/SharedStateManager';
import { Message, FurnitureDesign } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

export function useFurnitureDesign() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Blueprint Buddy. I can help you design custom furniture. What would you like to build today?",
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { state, design } = useSharedState();
  const { toast } = useToast();

  // Initialize system
  useEffect(() => {
    orchestrator.initialize().catch(error => {
      toast({
        title: "Initialization Error",
        description: "Failed to start design system. Please refresh the page.",
        variant: "destructive"
      });
      console.error('Orchestrator initialization error:', error);
    });
  }, [toast]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    
    try {
      // Process with orchestrator
      const result = await orchestrator.processUserInput(content);
      
      // Create response message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.responseText || formatResponse(result),
        timestamp: new Date(),
        metadata: {
          design_snapshot: result.design,
          validation_issues: result.validation?.issues,
          suggestions: result.reasoning?.suggestions
        }
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Show validation issues if any
      if (result.validation?.issues?.length > 0 && !result.validation.isValid) {
        toast({
          title: "Design Notice",
          description: result.validation.issues[0],
          variant: "default"
        });
      }
      
      // Show success for valid designs
      if (result.validation?.isValid && result.design.furniture_type) {
        toast({
          title: "Design Valid ✓",
          description: "Your furniture design is structurally sound!",
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error('Design error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I encountered an issue processing your request. Let's try a different approach. Could you tell me:\n\n• What type of furniture you want to build?\n• Approximate dimensions?\n• Any specific requirements?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Processing Error",
        description: "Let's break down your request into smaller steps.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const reset = useCallback(async () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Blueprint Buddy. I can help you design custom furniture. What would you like to build today?",
      timestamp: new Date()
    }]);
    
    await orchestrator.reset();
  }, []);

  return {
    messages,
    design: design as FurnitureDesign,
    isLoading,
    sendMessage,
    validationResults: state.validation_results,
    reset
  };
}

function formatResponse(result: any): string {
  const { design, validation, variations, reasoning } = result;
  
  let response = '';
  
  // Main design confirmation
  if (design?.furniture_type) {
    response += `I've created a design for your ${design.furniture_type}. `;
  }
  
  if (design?.dimensions) {
    const { width, height, depth } = design.dimensions;
    if (width && height && depth) {
      response += `The dimensions are ${width}" W × ${height}" H × ${depth}" D. `;
    }
  }
  
  if (design?.materials?.length > 0) {
    response += `I've selected ${design.materials[0].type || design.materials[0]} for this project. `;
  }
  
  // Validation status
  if (validation?.isValid) {
    response += "\n\n✅ The design is structurally sound and ready to build!";
  } else if (validation?.issues?.length > 0) {
    response += "\n\n⚠️ Some considerations: " + validation.issues[0];
  }
  
  // Variations
  if (variations?.length > 0) {
    response += "\n\nI've also created some design variations you might like.";
  }
  
  // Next steps
  if (!design?.materials?.length) {
    response += "\n\nWhat type of wood or material would you like to use?";
  } else if (!design?.validation_status) {
    response += "\n\nWould you like me to validate the structural integrity?";
  } else {
    response += "\n\nWould you like to see the cut list or make any adjustments?";
  }
  
  return response;
}