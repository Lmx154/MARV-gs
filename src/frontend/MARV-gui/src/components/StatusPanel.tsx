import React, { useMemo } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { Panel } from './layout/Panel';
import { BoltIcon, WifiIcon } from '@heroicons/react/24/outline';

export const StatusPanel: React.FC = () => {
  const { currentPacket, sessionMaxima } = useTelemetryStore();

  const currentMetrics = useMemo(() => {
    if (!currentPacket) return null;

    const accelMagnitude = Math.sqrt(
      currentPacket.imu.accel.x ** 2 + 
      currentPacket.imu.accel.y ** 2 + 
      currentPacket.imu.accel.z ** 2
    );
    
    const velocityMagnitude = Math.sqrt(
      currentPacket.velocity.x ** 2 + 
      currentPacket.velocity.y ** 2 + 
      currentPacket.velocity.z ** 2
    );
    
    const gForce = accelMagnitude / 9.81;

    return {
      altitude: currentPacket.baro.altitude,
      velocity: velocityMagnitude,
      acceleration: accelMagnitude,
      gForce,
      battery: currentPacket.battery,
      rssi: currentPacket.rssi,
      phase: currentPacket.phase,
    };
  }, [currentPacket]);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'pre-flight': return 'text-gray-500';
      case 'powered-ascent': return 'text-orange-500 animate-pulse';
      case 'burnout': return 'text-yellow-500';
      case 'apogee': return 'text-blue-500 animate-pulse';
      case 'drogue-deploy': return 'text-purple-500';
      case 'main-deploy': return 'text-green-500';
      case 'landed': return 'text-gray-700';
      default: return 'text-gray-500';
    }
  };

  const getPhaseGlow = (phase: string) => {
    switch (phase) {
      case 'powered-ascent': return 'animate-glow-orange';
      case 'apogee': return 'animate-glow-blue';
      case 'drogue-deploy': return 'animate-glow-purple';
      case 'main-deploy': return 'animate-glow-green';
      default: return '';
    }
  };

  const getBatteryColor = (battery: number) => {
    if (battery > 3.7) return 'text-green-500';
    if (battery > 3.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRSSIColor = (rssi: number) => {
    if (rssi > -50) return 'text-green-500';
    if (rssi > -70) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!currentMetrics) {
    return (
      <Panel>
        <div className="flex items-center justify-center h-32 text-gray-500">No telemetry data</div>
      </Panel>
    );
  }

  return (
    <Panel>
      
      {/* Flight Phase */}
      <div className="mb-6 text-center">
        <div className={`text-3xl font-bold uppercase tracking-wider ${getPhaseColor(currentMetrics.phase)} ${getPhaseGlow(currentMetrics.phase)}`}>
          {currentMetrics.phase.replace('-', ' ')}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Altitude */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {currentMetrics.altitude.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-sm text-blue-600 font-medium">
            {sessionMaxima.maxAltitude.toFixed(1)} m
          </div>
          <div className="text-xs text-gray-400">Max Altitude</div>
        </div>

        {/* Velocity */}
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {currentMetrics.velocity.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-sm text-green-600 font-medium">
            {sessionMaxima.maxVelocity.toFixed(1)} m/s
          </div>
          <div className="text-xs text-gray-400">Max Velocity</div>
        </div>

        {/* G-Force */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${currentMetrics.gForce > 10 ? 'text-red-500' : 'text-gray-900'}`}>
            {currentMetrics.gForce.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-sm text-orange-600 font-medium">
            {sessionMaxima.maxGForce.toFixed(1)} G
          </div>
          <div className="text-xs text-gray-400">Max G-Force</div>
        </div>

        {/* System Status */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <BoltIcon className={`w-6 h-6 ${getBatteryColor(currentMetrics.battery)}`} />
            <span className={`text-sm font-medium ${getBatteryColor(currentMetrics.battery)}`}>
              {currentMetrics.battery.toFixed(1)}V
            </span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <WifiIcon className={`w-5 h-5 ${getRSSIColor(currentMetrics.rssi)}`} />
            <span className={`text-xs ${getRSSIColor(currentMetrics.rssi)}`}>
              {currentMetrics.rssi.toFixed(0)} dBm
            </span>
          </div>
        </div>
      </div>
  </Panel>
  );
};