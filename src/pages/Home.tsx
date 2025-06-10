import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hammer, Sparkles, Clock, DollarSign } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">Blueprint Buddy</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Design custom furniture with AI assistance
        </p>
        <Button size="lg" onClick={() => navigate('/designer')} className="gap-2">
          <Sparkles className="h-5 w-5" />
          Start Designing
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
        <Card>
          <CardHeader>
            <Hammer className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>AI-Powered Design</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Describe what you want to build and our AI creates complete plans
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>3D Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              See your furniture in 3D before you build it
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Clock className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Complete Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Get cut lists, assembly instructions, and material lists
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <DollarSign className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Cost Estimates</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Know your material costs before you start building
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="mt-16 text-center">
        <h2 className="text-3xl font-bold mb-8">How It Works</h2>
        <div className="max-w-3xl mx-auto space-y-4 text-left">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold">Describe Your Project</h3>
              <p className="text-muted-foreground">
                Tell us what you want to build using natural language
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold">AI Generates Design</h3>
              <p className="text-muted-foreground">
                Our AI creates a complete, buildable design with proper dimensions and joinery
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold">Review and Customize</h3>
              <p className="text-muted-foreground">
                View in 3D, adjust dimensions, change materials, and validate the design
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h3 className="font-semibold">Build with Confidence</h3>
              <p className="text-muted-foreground">
                Download complete plans with cut lists and step-by-step instructions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}