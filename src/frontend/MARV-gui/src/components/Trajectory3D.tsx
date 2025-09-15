import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTelemetryStore } from '../store/telemetryStore';
import { Panel } from './layout/Panel';
import { TelemetryPacket } from '../types/TelemetryPacket';

// Convert telemetry history into 3D trajectory points (using GPS lat/lon as planar coords, altitude as Z)
// Generate smoothed, normalized (scaled & centered) trajectory points so path stays in view
const useTrajectoryPoints = (targetExtent: number) => {
  const { history } = useTelemetryStore();
  return useMemo(() => {
    if (history.length === 0) return [] as THREE.Vector3[];
    // Reference origin
    const origin = history.find(p => p.gps.lat !== 0 && p.gps.lon !== 0);
    if (!origin) return [] as THREE.Vector3[];
    const R = 6371000; // earth radius
    const lat0 = origin.gps.lat * Math.PI/180;
    const lon0 = origin.gps.lon * Math.PI/180;
  const raw = history.filter(p => p.gps.lat && p.gps.lon).map(p => {
      const lat = p.gps.lat * Math.PI/180;
      const lon = p.gps.lon * Math.PI/180;
      const x = (lon - lon0) * Math.cos((lat+lat0)/2) * R;
      const y = (lat - lat0) * R;
      const z = p.baro.altitude;
      return new THREE.Vector3(x, z, y); // swap to have altitude up
    });
    // Simple smoothing (moving average window 5)
    const window = 5;
    const smooth: THREE.Vector3[] = [];
    for (let i=0;i<raw.length;i++) {
      const start = Math.max(0, i-window+1);
      const slice = raw.slice(start, i+1);
      const avg = slice.reduce((acc,v)=>acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1/slice.length);
      smooth.push(avg);
    }
  // Compute bounding box
  const bbox = new THREE.Box3();
  smooth.forEach(p => bbox.expandByPoint(p));
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const scale = targetExtent / maxDim;
  // Apply scaling
  const smoothScaled = smooth.map(p => p.clone().multiplyScalar(scale));
  // Compute new bounding box after scaling
  const bboxScaled = new THREE.Box3();
  smoothScaled.forEach(p => bboxScaled.expandByPoint(p));
  const centerScaled = new THREE.Vector3();
  bboxScaled.getCenter(centerScaled);
  // Center the scaled points
  const normalized = smoothScaled.map(p => p.clone().sub(centerScaled));
  // Shift Y so minimum Y is 0 to prevent clipping
  const minY = Math.min(...normalized.map(p => p.y));
  const shiftY = minY < 0 ? -minY : 0;
  return normalized.map(p => p.clone().setY(p.y + shiftY));
  }, [history, targetExtent]);
};

const phaseColor = (phase: string) => {
  switch (phase) {
    case 'pre-flight': return '#64748b';
    case 'powered-ascent': return '#f97316';
    case 'burnout': return '#eab308';
    case 'apogee': return '#3b82f6';
    case 'drogue-deploy': return '#8b5cf6';
    case 'main-deploy': return '#10b981';
    case 'landed': return '#475569';
    default: return '#334155';
  }
};

// Helper to extract first index of key flight events
const getPhaseEventIndices = (history: TelemetryPacket[]) => {
  const events = ['burnout','apogee','drogue-deploy','main-deploy'] as const;
  const map: Partial<Record<typeof events[number], number>> = {};
  for (let i=0;i<history.length;i++) {
    const ph = history[i].phase as typeof events[number];
    if (events.includes(ph) && map[ph] == null) map[ph] = i;
    if (Object.keys(map).length === events.length) break;
  }
  return map;
};

interface SegmentedTrajectoryProps {
  targetExtent: number;
  onPointSelect: (index: number) => void;
  selectedIndex: number | null;
  locked: boolean;
}

const SegmentedTrajectory: React.FC<SegmentedTrajectoryProps> = ({ targetExtent, onPointSelect, selectedIndex, locked }) => {
  const { history } = useTelemetryStore();
  const points = useTrajectoryPoints(targetExtent);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (points.length < 2) return null;

  const segments: { color: string; pts: THREE.Vector3[]; indices: number[] }[] = [];
  let currentPhase = history[0].phase;
  let collector: THREE.Vector3[] = [points[0]];
  let indexCollector: number[] = [0];
  for (let i = 1; i < history.length; i++) {
    const phase = history[i].phase;
    collector.push(points[i]);
    indexCollector.push(i);
    if (phase !== currentPhase) {
      segments.push({ color: phaseColor(currentPhase), pts: collector, indices: indexCollector });
      collector = [points[i]];
      indexCollector = [i];
      currentPhase = phase;
    }
  }
  if (collector.length > 1) segments.push({ color: phaseColor(currentPhase), pts: collector, indices: indexCollector });

  const handleClick = (segmentIndex: number, pointIndex: number) => {
    const globalIndex = segments[segmentIndex].indices[pointIndex];
    onPointSelect(globalIndex);
  };

  return (
    <group>
      {segments.map((s, segIdx) => (
        <group key={segIdx}>
          <Line points={s.pts} color={s.color} lineWidth={2} />
          {s.pts.map((p, idx) => {
            const gIndex = s.indices[idx];
            // Invisible (or tiny) interaction spheres
            return (
              <mesh
                key={`${segIdx}-${idx}`}
                position={p}
                onClick={(e) => { e.stopPropagation(); handleClick(segIdx, idx); }}
                onPointerOver={() => setHoveredPoint(gIndex)}
                onPointerOut={() => setHoveredPoint(null)}
              >
                <sphereGeometry args={[1.2, 8, 8]} />
                <meshBasicMaterial
                  color={gIndex === selectedIndex ? '#9333ea' : hoveredPoint === gIndex && !locked ? '#a855f7' : '#000000'}
                  transparent
                  opacity={gIndex === selectedIndex ? 0.85 : hoveredPoint === gIndex && !locked ? 0.5 : 0}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
};

const LiveMarker: React.FC<{ targetExtent: number }> = ({ targetExtent }) => {
  const { currentPacket } = useTelemetryStore();
  const meshRef = useRef<THREE.Mesh>(null);
  const points = useTrajectoryPoints(targetExtent);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (meshRef.current && points.length) {
      meshRef.current.position.copy(points[points.length - 1]);
    }
    if (matRef.current) {
      // Blink white over red base
      const t = clock.getElapsedTime();
      const pulse = (Math.sin(t * 6) + 1) / 2; // 0..1
      matRef.current.color.set('#dc2626'); // base red
      matRef.current.emissive.setRGB(pulse, pulse, pulse);
      matRef.current.emissiveIntensity = 0.6 * pulse;
    }
  });
  if (!currentPacket || points.length === 0) return null;
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 16, 16]} />
      <meshStandardMaterial ref={matRef} color="#dc2626" emissive="#ffffff" emissiveIntensity={0.5} />
    </mesh>
  );
};

const LaunchPointMarker: React.FC<{ targetExtent: number }> = ({ targetExtent }) => {
  const points = useTrajectoryPoints(targetExtent);
  if (!points.length) return null;
  return (
    <mesh position={points[0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[3, 24]} />
      <meshStandardMaterial color="#10B981" />
    </mesh>
  );
};

// Phase event markers: burnout, apogee, drogue deploy, main deploy
const PhaseEventMarkers: React.FC<{ targetExtent: number }> = ({ targetExtent }) => {
  const { history } = useTelemetryStore();
  const points = useTrajectoryPoints(targetExtent);
  if (history.length === 0 || points.length === 0) return null;

  // Map phase -> first index
  const phasesOfInterest: Record<string, { color: string; radius: number }> = {
    'burnout': { color: '#eab308', radius: 3.2 },
    'apogee': { color: '#3b82f6', radius: 4 },
    'drogue-deploy': { color: '#8b5cf6', radius: 3.2 },
    'main-deploy': { color: '#10b981', radius: 3.2 },
  };

  const firstIndices: { phase: string; index: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < history.length && i < points.length; i++) {
    const ph = history[i].phase;
    if (phasesOfInterest[ph] && !seen.has(ph)) {
      firstIndices.push({ phase: ph, index: i });
      seen.add(ph);
    }
    if (seen.size === Object.keys(phasesOfInterest).length) break;
  }

  if (!firstIndices.length) return null;

  return (
    <group>
      {firstIndices.map(({ phase, index }) => {
        if (index < 0 || index >= points.length) return null;
        const cfg = phasesOfInterest[phase];
        const pos = points[index];
        // Represent each event as a small ring + inner filled disc for clarity
        return (
          <group position={pos} key={phase}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[cfg.radius * 0.6, cfg.radius, 20]} />
              <meshBasicMaterial color={cfg.color} transparent opacity={0.9} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[cfg.radius * 0.4, 16]} />
              <meshBasicMaterial color={cfg.color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Removed in-panel popup; stats shown in overlay panel instead.

const ScrollMarker: React.FC<{ targetExtent: number; index: number | null; color?: string }> = ({ targetExtent, index, color = '#9333ea' }) => {
  const points = useTrajectoryPoints(targetExtent);
  if (index == null || !points.length || index >= points.length) return null;
  return (
    <mesh position={points[index]}>
      <sphereGeometry args={[2.2, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
};

interface SceneProps {
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  scrollIndex: number | null;
  locked: boolean;
}

const Scene: React.FC<SceneProps> = ({ selectedIndex, onSelect, scrollIndex, locked }) => {
  const { viewport } = useThree();
  const targetExtent = Math.min(viewport.width, viewport.height) * 0.5;
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[200,200,100]} intensity={1} />
      <gridHelper args={[targetExtent * 2, 30, '#94a3b8', '#e2e8f0']} />
      <axesHelper args={[targetExtent]} />
      <SegmentedTrajectory
        targetExtent={targetExtent}
        onPointSelect={onSelect}
        selectedIndex={selectedIndex}
        locked={locked}
      />
  <LaunchPointMarker targetExtent={targetExtent} />
  <PhaseEventMarkers targetExtent={targetExtent} />
  <LiveMarker targetExtent={targetExtent} />
  {/* Selection marker only visible while navigating (unlocked) */}
  {!locked && <ScrollMarker targetExtent={targetExtent} index={scrollIndex} />}
      <OrbitControls
        makeDefault
        enableZoom={locked || selectedIndex == null}
        enablePan={locked || selectedIndex == null}
        enableRotate={true}
      />
    </>
  );
};

export const Trajectory3D: React.FC = () => {
  const { history } = useTelemetryStore();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [scrollIndex, setScrollIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const phaseEvents = useMemo(()=>getPhaseEventIndices(history), [history]);

  // Scroll navigation only when a point is selected AND not locked; otherwise allow zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (locked || selectedIndex == null || !history.length) return; // let OrbitControls handle zoom
    e.preventDefault(); // consume for navigation mode
    const maxIndex = history.length - 1;
    setScrollIndex(prev => {
      const base = prev == null ? selectedIndex : prev;
      const delta = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(maxIndex, base + delta));
      setSelectedIndex(next);
      return next;
    });
  }, [locked, history.length, selectedIndex]);

  React.useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const packet: TelemetryPacket | null = (selectedIndex != null && history[selectedIndex]) ? history[selectedIndex] : null;

  const format = (n: number, d = 2) => n.toFixed(d);

  return (
    <Panel>
      <div className="w-full h-full relative select-none">
        <Canvas camera={{ position: [150, 180, 180], fov: 60 }} className="w-full h-full">
          <Scene
            selectedIndex={selectedIndex}
            onSelect={(i) => {
              // First click establishes selection; also set starting scroll index
              setSelectedIndex(i);
              if (!locked && scrollIndex == null) setScrollIndex(i);
            }}
            scrollIndex={scrollIndex}
            locked={locked}
          />
        </Canvas>

        {/* Bottom-right stats overlay */}
  <div className="absolute bottom-2 right-2 z-10 w-64 bg-white-95 backdrop-blur border border-gray-300 rounded-md shadow px-3 py-2 text-11px font-mono text-gray-700 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold tracking-wide text-gray-800 text-xs">POINT STATS</span>
            <button
              onClick={() => setLocked(l => !l)}
              className={`px-2 py-0.5 rounded text-xs font-semibold border ${locked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'}`}
            >
              {locked ? 'LOCKED' : 'UNLOCK'}
            </button>
          </div>
          {packet ? (
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>T:</span><span>{new Date(packet.timestamp).toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>PH:</span><span className="uppercase">{packet.phase.replace('-', ' ')}</span></div>
              <div className="flex justify-between"><span>LAT:</span><span>{format(packet.gps.lat,5)}</span></div>
              <div className="flex justify-between"><span>LON:</span><span>{format(packet.gps.lon,5)}</span></div>
              <div className="flex justify-between"><span>ALT:</span><span>{format(packet.baro.altitude,1)}m</span></div>
              <div className="flex justify-between"><span>VEL:</span><span>{format(Math.sqrt(packet.velocity.x**2+packet.velocity.y**2+packet.velocity.z**2),2)}m/s</span></div>
              <div className="flex justify-between"><span>ACC:</span><span>{format(Math.sqrt(packet.imu.accel.x**2+packet.imu.accel.y**2+packet.imu.accel.z**2),2)}m/s²</span></div>
              <div className="flex justify-between"><span>GYR:</span><span>{format(Math.sqrt(packet.imu.gyro.x**2+packet.imu.gyro.y**2+packet.imu.gyro.z**2),2)}°/s</span></div>
              <div className="flex justify-between"><span>BAT:</span><span>{format(packet.battery,1)}V</span></div>
              <div className="flex justify-between"><span>RSSI:</span><span>{format(packet.rssi,0)}dBm</span></div>
            </div>
          ) : (
            <div className="text-gray-500 text-xs">Scroll or click a point…</div>
          )}
          <div className="pt-1 flex gap-2">
            <button
              onClick={() => { setSelectedIndex(history.length ? history.length - 1 : null); if (!locked) setScrollIndex(history.length ? history.length - 1 : null); }}
              className="flex-1 border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-100"
            >Live</button>
            <button
              onClick={() => { setSelectedIndex(null); setScrollIndex(null); setLocked(false); }}
              className="flex-1 border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-100"
            >Clear</button>
          </div>
        </div>

        {/* Bottom-left legend */}
  <div className="absolute bottom-2 left-2 z-10 bg-white-90 border border-gray-300 rounded px-1 py-0.5 text-8px text-gray-600 flex flex-wrap gap-x-2 gap-y-0.5 items-center max-w-xs select-none">
          <button type="button" onClick={()=> { if (history.length) { setSelectedIndex(0); if (!locked) setScrollIndex(0);} }} className="flex items-center space-x-1 hover:underline">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> <span>Launch</span>
          </button>
          <button type="button" disabled={phaseEvents['burnout']==null} onClick={()=> { const i=phaseEvents['burnout']; if (i!=null){ setSelectedIndex(i); if(!locked) setScrollIndex(i);} }} className={`flex items-center space-x-1 ${phaseEvents['burnout']!=null?'hover:underline':'opacity-40 cursor-default'}`}>
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> <span>Burnout</span>
          </button>
          <button type="button" disabled={phaseEvents['apogee']==null} onClick={()=> { const i=phaseEvents['apogee']; if (i!=null){ setSelectedIndex(i); if(!locked) setScrollIndex(i);} }} className={`flex items-center space-x-1 ${phaseEvents['apogee']!=null?'hover:underline':'opacity-40 cursor-default'}`}>
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> <span>Apogee</span>
          </button>
            <button type="button" disabled={phaseEvents['drogue-deploy']==null} onClick={()=> { const i=phaseEvents['drogue-deploy']; if (i!=null){ setSelectedIndex(i); if(!locked) setScrollIndex(i);} }} className={`flex items-center space-x-1 ${phaseEvents['drogue-deploy']!=null?'hover:underline':'opacity-40 cursor-default'}`}>
            <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" /> <span>Drogue</span>
          </button>
          <button type="button" disabled={phaseEvents['main-deploy']==null} onClick={()=> { const i=phaseEvents['main-deploy']; if (i!=null){ setSelectedIndex(i); if(!locked) setScrollIndex(i);} }} className={`flex items-center space-x-1 ${phaseEvents['main-deploy']!=null?'hover:underline':'opacity-40 cursor-default'}`}>
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> <span>Main</span>
          </button>
          <div className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-red-600 animate-pulse inline-block" /> <span>Live</span></div>
          {!locked && <div className="flex items-center space-x-1"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block" /> <span>Navigate</span></div>}
        </div>
      </div>
    </Panel>
  );
};

export default Trajectory3D;