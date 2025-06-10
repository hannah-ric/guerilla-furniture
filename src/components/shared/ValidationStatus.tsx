import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ValidationStatus({ results }: { results: Map<string, any> }) {
  const validationItems = Array.from(results.entries());
  
  if (validationItems.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No validation results yet</p>
        <p className="text-sm mt-2">
          Complete your design to see validation results
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {validationItems.map(([agent, result]) => (
        <Card key={agent}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {result.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {agent.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.issues?.length > 0 && (
              <div className="space-y-2">
                {result.issues.map((issue: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <span className="text-red-600">• </span>
                    {issue.message || issue}
                  </div>
                ))}
              </div>
            )}
            
            {result.warnings?.length > 0 && (
              <div className="space-y-2 mt-2">
                {result.warnings.map((warning: string, idx: number) => (
                  <div key={idx} className="text-sm">
                    <span className="text-yellow-600">• </span>
                    {warning}
                  </div>
                ))}
              </div>
            )}
            
            {result.suggestions?.length > 0 && (
              <div className="space-y-2 mt-2">
                {result.suggestions.map((suggestion: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    <span className="text-blue-600">💡 </span>
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            
            {result.valid && !result.issues?.length && !result.warnings?.length && (
              <p className="text-sm text-green-600">
                ✓ All checks passed
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}