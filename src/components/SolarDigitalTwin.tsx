// src/components/SolarDigitalTwin.tsx
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SolarDigitalTwinProps {
  azimuth: number; // e.g. -45 to 45
  elevation: number; // e.g. 0 to 90
}

interface PanelAssemblyProps {
  azimuth: number;
  elevation: number;
}

function PanelAssembly({ azimuth, elevation }: PanelAssemblyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.Group>(null);

  // Convert angles to radians
  const azimuthRad = (azimuth * Math.PI) / 180;
  const tiltRad = ((90 - elevation) * Math.PI) / 180;

  // Smooth transitions in frames
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, -azimuthRad, 0.1);
    }
    if (panelRef.current) {
      panelRef.current.rotation.x = THREE.MathUtils.lerp(panelRef.current.rotation.x, tiltRad, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.7, 0]}>
      {/* Rotating vertical bracket pivot */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.25, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Tiltable Solar Panel Assembly */}
      <group ref={panelRef}>
        {/* Panel backing structure */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.7, 0.05, 1.05]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Photovoltaic cells surface */}
        <mesh position={[0, 0.076, 0]}>
          <boxGeometry args={[1.6, 0.01, 0.95]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.8} />
        </mesh>

        {/* Photovoltaic panel blue glass shader overlay */}
        <mesh position={[0, 0.082, 0]}>
          <boxGeometry args={[1.58, 0.005, 0.93]} />
          <meshStandardMaterial color="#0284c7" transparent={true} opacity={0.4} roughness={0.05} metalness={0.9} />
        </mesh>

        {/* Grid wireframe helper representing solar cell segment patterns */}
        <mesh position={[0, 0.086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.55, 0.9]} />
          <meshBasicMaterial color="#38bdf8" wireframe={true} transparent={true} opacity={0.4} />
        </mesh>

        {/* Actuator arm endpoints (red rivets) */}
        <mesh position={[-0.85, 0.05, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
        <mesh position={[0.85, 0.05, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
      </group>
    </group>
  );
}

export default function SolarDigitalTwin({ azimuth, elevation }: SolarDigitalTwinProps) {
  return (
    <div className="w-full h-full min-h-[260px] bg-slate-950/65 rounded-2xl overflow-hidden relative border border-cyan-500/10 flex flex-col justify-between">
      {/* HUD Header */}
      <div className="absolute top-3 left-3 text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest pointer-events-none z-10 font-black flex items-center gap-1.5 text-glow-cyan">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        IoT Digital Twin Port v1D
      </div>
      
      <div className="absolute bottom-3 right-3 text-[8.5px] font-mono text-slate-500 pointer-events-none z-10 tracking-widest uppercase">
        AZM: {azimuth.toFixed(0)}° | ELV: {elevation.toFixed(0)}°
      </div>

      <div className="flex-grow w-full relative pointer-events-none">
        <Canvas camera={{ position: [0, 2.2, 3.4], fov: 45 }}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[10, 15, 10]} intensity={1.8} castShadow={true} />
          <pointLight position={[-6, 6, -6]} intensity={0.6} />

          {/* Stand Assembly */}
          <group position={[0, -0.6, 0]}>
            {/* Ground grid coordinate helper */}
            <gridHelper args={[4, 12, "#06b6d4", "#1e293b"]} position={[0, -0.04, 0]} />

            {/* Vertical mounting stand pillar */}
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.07, 0.075, 0.7, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Panel brackets & assembly */}
            <PanelAssembly azimuth={azimuth} elevation={elevation} />
          </group>
        </Canvas>
      </div>
    </div>
  );
}
