import React from 'react';
import { FurnitureDesign } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  design: FurnitureDesign | null;
}

export function BuildPlanDetails({ design }: Props) {
  if (!design) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No design details yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dimensions</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt>Width:</dt>
              <dd className="font-medium">{design.dimensions?.width}"</dd>
            </div>
            <div className="flex justify-between">
              <dt>Height:</dt>
              <dd className="font-medium">{design.dimensions?.height}"</dd>
            </div>
            <div className="flex justify-between">
              <dt>Depth:</dt>
              <dd className="font-medium">{design.dimensions?.depth}"</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {design.materials?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {design.materials.map((material, idx) => (
                <li key={idx}>{material.type || material}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {design.estimated_cost && (
        <Card>
          <CardHeader>
            <CardTitle>Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${design.estimated_cost}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}