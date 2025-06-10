import React from 'react';
import { useFurnitureDesign } from '@/hooks/useFurnitureDesign';
import { DesignChatInterface } from '@/components/chat/DesignChatInterface';
import { FurnitureViewer } from '@/components/viewer/FurnitureViewer';
import { BuildPlanDetails } from '@/components/details/BuildPlanDetails';
import { ValidationStatus } from '@/components/shared/ValidationStatus';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save } from 'lucide-react';

export function Designer() {
  const navigate = useNavigate();
  const { messages, design, isLoading, sendMessage, validationResults } = useFurnitureDesign();
  
  const handleSave = async () => {
    // TODO: Implement save functionality
    console.log('Saving design:', design);
  };
  
  const handleDownload = async () => {
    // TODO: Implement download functionality
    console.log('Downloading plans:', design);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Furniture Designer</h1>
            <p className="text-sm text-muted-foreground">
              {design?.name || 'New Design'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!design?.validation_status || design.validation_status !== 'valid'}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!design?.furniture_type}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="w-1/2 border-r flex flex-col">
          <DesignChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            suggestions={[
              "Build a modern bookshelf for my living room",
              "I need a coffee table that fits in a small space",
              "Design a standing desk with cable management",
              "Create a dining table for 6 people"
            ]}
          />
        </div>
        
        {/* Preview Section */}
        <div className="w-1/2 flex flex-col">
          <Tabs defaultValue="3d" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="3d">3D Preview</TabsTrigger>
              <TabsTrigger value="details">Build Details</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>
            
            <TabsContent value="3d" className="flex-1">
              <FurnitureViewer 
                design={design}
                showDimensions
                enableAnimation
              />
            </TabsContent>
            
            <TabsContent value="details" className="flex-1 overflow-auto">
              <BuildPlanDetails design={design} />
            </TabsContent>
            
            <TabsContent value="validation" className="flex-1 overflow-auto p-4">
              <ValidationStatus results={validationResults} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}