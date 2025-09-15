import React, { useEffect, useRef } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronDownIcon, PlayIcon, StopIcon, WifiIcon } from '@heroicons/react/24/outline';
import { useTelemetryStore } from '../store/telemetryStore';
import { useTelemetryWebSocket } from '../hooks/useTelemetryWebSocket';
import { useTelemetrySimulation } from '../hooks/useTelemetrySimulation';
import { format } from 'date-fns';

// Mock serial devices for development
const MOCK_DEVICES = [
  '/dev/ttyUSB0 - Flight Computer',
  '/dev/ttyUSB1 - Ground Station',
  '/dev/ttyACM0 - Arduino Mega',
  'COM3 - Serial Bridge',
  'COM7 - USB UART',
];

export const ControlPanel: React.FC = () => {
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const {
    isConnected,
    isSimulating,
    selectedDevice,
    logs,
    followLatest,
    setSelectedDevice,
    setSimulating,
    setFollowLatest,
    addLog,
  } = useTelemetryStore();

  // WebSocket connection for real telemetry
  const wsUrl = (() => {
    if (typeof window === 'undefined') return 'ws://localhost:8000/ws';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  })();

  const { connect, disconnect } = useTelemetryWebSocket({
    url: wsUrl,
    // Use manual connect/disconnect; keep disabled only when simulating
    enabled: !isSimulating,
  });

  // Simulation for development
  useTelemetrySimulation();

  // Auto-scroll console when followLatest is enabled
  useEffect(() => {
    if (followLatest && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, followLatest]);

  const handleConnect = () => {
    if (isConnected) {
      if (isSimulating) {
        setSimulating(false);
      } else {
        disconnect();
      }
    } else {
      if (selectedDevice.includes('Simulation') || !selectedDevice) {
        setSimulating(true);
      } else {
        connect();
      }
    }
  };

  const handleDeviceSelect = (device: string) => {
    setSelectedDevice(device);
    addLog({
      type: 'info',
      message: `Selected device: ${device}`,
      timestamp: new Date(),
    });
  };

  return (
  <div className="h-full bg-white border-l border-gray-200 flex flex-col" style={{minWidth:300}}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Control Panel</h2>
        
        {/* Device Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Telemetry Source
          </label>
          <Listbox value={selectedDevice} onChange={handleDeviceSelect}>
            <div className="relative">
              <Listbox.Button className="cp-select-trigger">
                <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {selectedDevice || 'Select Device'}
                </span>
                <ChevronDownIcon className="cp-select-chevron" />
              </Listbox.Button>
              <Listbox.Options className="cp-options">
                <Listbox.Option value="Simulation Mode" className={({active})=>`cp-option ${active?'active':''}`}>Simulation Mode</Listbox.Option>
                {MOCK_DEVICES.map(device => (
                  <Listbox.Option key={device} value={device} className={({active})=>`cp-option ${active?'active':''}`}>{device}</Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>

        {/* Connection Button */}
        <button onClick={handleConnect} disabled={!selectedDevice} className={`cp-connect ${isConnected?'disconnect':''}`}> 
          {isConnected ? <StopIcon /> : <PlayIcon />}
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>

        {/* Connection Status */}
        <div className={`cp-status ${isConnected?'connected':''}`}>
          <div className="dot" />
          <span>{isConnected ? (isSimulating ? 'Simulation Active' : 'Connected') : 'Disconnected'}</span>
        </div>
      </div>

      {/* Console */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Console</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={followLatest}
              onChange={(e) => setFollowLatest(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-xs text-gray-600">Follow Latest</span>
          </label>
        </div>
        
        <div
          ref={consoleRef}
          className="flex-1 bg-black text-green-400 font-mono text-xs p-3 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">No messages...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500">
                  [{format(log.timestamp, 'HH:mm:ss.SSS')}]
                </span>
                <span
                  className={`ml-2 ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'warning'
                      ? 'text-yellow-400'
                      : log.type === 'success'
                      ? 'text-green-400'
                      : 'text-white'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};