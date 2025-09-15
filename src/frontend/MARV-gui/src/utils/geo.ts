import * as THREE from 'three';
import { TelemetryPacket } from '../types/TelemetryPacket';

export interface TrajectoryPoint3D {
  point: THREE.Vector3;
  phase: string;
  packet: TelemetryPacket;
}

// Convert lat/lon/alt history to local ENU coordinates (meters) with smoothing.
export function toLocalSmoothed(points: TelemetryPacket[], smoothingWindow = 5): TrajectoryPoint3D[] {
  if (!points.length) return [];
  const origin = points.find(p => p.gps.lat !== 0 && p.gps.lon !== 0);
  if (!origin) return [];
  const R = 6371000;
  const lat0 = origin.gps.lat * Math.PI/180;
  const lon0 = origin.gps.lon * Math.PI/180;
  const raw = points.map(p => {
    const lat = p.gps.lat * Math.PI/180;
    const lon = p.gps.lon * Math.PI/180;
    const x = (lon - lon0) * Math.cos((lat+lat0)/2) * R; // East
    const y = (lat - lat0) * R; // North
    const z = p.baro.altitude;  // Up
    return { point: new THREE.Vector3(x, z, y), packet: p, phase: p.phase };
  });

  if (smoothingWindow <= 1) return raw;
  const smooth: TrajectoryPoint3D[] = [];
  for (let i=0;i<raw.length;i++) {
    const start = Math.max(0, i - smoothingWindow + 1);
    const slice = raw.slice(start, i+1);
    const avg = slice.reduce((acc, v) => acc.add(v.point), new THREE.Vector3()).multiplyScalar(1/slice.length);
    smooth.push({ point: avg, packet: raw[i].packet, phase: raw[i].phase });
  }
  return smooth;
}

export function phaseColor(phase: string): string {
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
}
