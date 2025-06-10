import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';

export function SavedPlans() {
  const navigate = useNavigate();
  
  // TODO: Load saved plans from Supabase
  const plans = [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Saved Plans</h1>
        </div>
        
        <Button onClick={() => navigate('/designer')}>
          <Plus className="h-4 w-4 mr-2" />
          New Design
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You haven't saved any designs yet
            </p>
            <Button onClick={() => navigate('/designer')}>
              Create Your First Design
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Plan cards would go here */}
        </div>
      )}
    </div>
  );
}