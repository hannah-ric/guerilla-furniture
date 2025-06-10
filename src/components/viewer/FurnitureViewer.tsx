import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box } from '@react-three/drei';
import { FurnitureDesign } from '@/lib/types';

interface Props {
  design: FurnitureDesign | null;
  showDimensions?: boolean;
  enableAnimation?: boolean;
}

export function FurnitureViewer({ design, showDimensions, enableAnimation }: Props) {
  if (!design?.dimensions) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No design to preview yet</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Grid args={[10, 10]} />
          
          {/* Placeholder box - replace with actual 3D model */}
          <Box args={[
            design.dimensions.width / 12,
            design.dimensions.height / 12,
            design.dimensions.depth / 12
          ]}>
            <meshStandardMaterial color="#8B4513" />
          </Box>
          
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Suspense>
      </Canvas>
    </div>
  );
}