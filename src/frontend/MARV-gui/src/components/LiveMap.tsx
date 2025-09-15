import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { useTelemetryStore } from '../store/telemetryStore';
import { Panel } from './layout/Panel';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to update map view when new data arrives
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
};

export const LiveMap: React.FC = () => {
  const { currentPacket, history } = useTelemetryStore();
  const mapRef = useRef<L.Map | null>(null);

  // Default to Albuquerque area (common rocketry location)
  const defaultCenter: [number, number] = [35.0844, -106.6504];
  
  // Get current position or use default
  const currentPosition: [number, number] = currentPacket 
    ? [currentPacket.gps.lat, currentPacket.gps.lon]
    : defaultCenter;

  // Create trail from history (last 100 points for performance)
  const trailPositions: [number, number][] = history
    .slice(-100)
    .filter(packet => packet.gps.lat !== 0 && packet.gps.lon !== 0)
    .map(packet => [packet.gps.lat, packet.gps.lon]);

  // Launch point (first valid GPS position)
  const launchPoint: [number, number] | null = history.find(
    packet => packet.gps.lat !== 0 && packet.gps.lon !== 0
  ) ? [history[0].gps.lat, history[0].gps.lon] : null;

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'pre-flight': return '#6B7280';
      case 'powered-ascent': return '#F97316';
      case 'burnout': return '#EAB308';
      case 'apogee': return '#3B82F6';
      case 'drogue-deploy': return '#8B5CF6';
      case 'main-deploy': return '#10B981';
      case 'landed': return '#4B5563';
      default: return '#6B7280';
    }
  };

  return (
    <Panel>
  <div className="absolute top-2 left-2 z-1000 bg-white-90 backdrop-blur rounded-md shadow px-2 py-1">
        {currentPacket && (
          <div className="text-10px leading-tight text-gray-700 font-mono">
            <div>Lat {currentPacket.gps.lat.toFixed(5)}</div>
            <div>Lon {currentPacket.gps.lon.toFixed(5)}</div>
            <div>Alt {currentPacket.gps.alt.toFixed(0)}m</div>
            <div>Hd {currentPacket.gps.heading.toFixed(0)}°</div>
          </div>
        )}
      </div>
      <MapContainer
        center={currentPosition}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater center={currentPosition} />
        
        {/* Launch Point Marker */}
        {launchPoint && (
          <Marker
            position={launchPoint}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #10B981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          />
        )}

        {/* Current Position Marker */}
        {currentPacket && currentPacket.gps.lat !== 0 && currentPacket.gps.lon !== 0 && (
          <Marker
            position={currentPosition}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="
                background-color: ${getPhaseColor(currentPacket.phase)}; 
                width: 16px; 
                height: 16px; 
                border-radius: 50%; 
                border: 3px solid white; 
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                position: relative;
              ">
                <div style="
                  width: 0; 
                  height: 0; 
                  border-left: 4px solid transparent; 
                  border-right: 4px solid transparent; 
                  border-bottom: 12px solid ${getPhaseColor(currentPacket.phase)};
                  position: absolute;
                  top: -6px;
                  left: 4px;
                  transform: rotate(${currentPacket.gps.heading - 45}deg);
                "></div>
              </div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          />
        )}

        {/* Flight Trail */}
        {trailPositions.length > 1 && (
          <Polyline
            positions={trailPositions}
            color="#3B82F6"
            weight={3}
            opacity={0.7}
          />
        )}
      </MapContainer>
    </Panel>
  );
};