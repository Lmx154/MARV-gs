import { create } from 'zustand';
import { TelemetryPacket, LogEntry, SessionMaxima, TrajectoryPoint } from '../types/TelemetryPacket';

interface TelemetryState {
  // Connection state
  isConnected: boolean;
  isSimulating: boolean;
  selectedDevice: string;
  
  // Telemetry data
  currentPacket: TelemetryPacket | null;
  history: TelemetryPacket[];
  sessionMaxima: SessionMaxima;
  
  // Console logs
  logs: LogEntry[];
  
  // Settings
  followLatest: boolean;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setSimulating: (simulating: boolean) => void;
  setSelectedDevice: (device: string) => void;
  addTelemetryPacket: (packet: TelemetryPacket) => void;
  addLog: (log: LogEntry) => void;
  setFollowLatest: (follow: boolean) => void;
  clearHistory: () => void;
}

const HISTORY_BUFFER_SIZE = 3000; // 60 seconds at 50Hz

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  isConnected: false,
  isSimulating: false,
  selectedDevice: '',
  currentPacket: null,
  history: [],
  sessionMaxima: {
    maxAltitude: 0,
    maxVelocity: 0,
    maxAcceleration: 0,
    maxGForce: 0,
  },
  logs: [],
  followLatest: true,

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
    get().addLog({
      type: connected ? 'success' : 'warning',
      message: connected ? 'Connected to telemetry source' : 'Disconnected from telemetry source',
      timestamp: new Date(),
    });
  },

  setSimulating: (simulating: boolean) => {
    set({ isSimulating: simulating });
    get().addLog({
      type: 'info',
      message: simulating ? 'Started simulation mode' : 'Stopped simulation mode',
      timestamp: new Date(),
    });
  },

  setSelectedDevice: (device: string) => set({ selectedDevice: device }),

  addTelemetryPacket: (packet: TelemetryPacket) => {
    const state = get();
    
    // Update current packet
    set({ currentPacket: packet });
    
    // Add to history with buffer management
    const newHistory = [...state.history, packet];
    if (newHistory.length > HISTORY_BUFFER_SIZE) {
      newHistory.shift();
    }
    
    // Update session maxima
    const accelMagnitude = Math.sqrt(
      packet.imu.accel.x ** 2 + packet.imu.accel.y ** 2 + packet.imu.accel.z ** 2
    );
    const velocityMagnitude = Math.sqrt(
      packet.velocity.x ** 2 + packet.velocity.y ** 2 + packet.velocity.z ** 2
    );
    const gForce = accelMagnitude / 9.81;
    
    const newMaxima: SessionMaxima = {
      maxAltitude: Math.max(state.sessionMaxima.maxAltitude, packet.baro.altitude),
      maxVelocity: Math.max(state.sessionMaxima.maxVelocity, velocityMagnitude),
      maxAcceleration: Math.max(state.sessionMaxima.maxAcceleration, accelMagnitude),
      maxGForce: Math.max(state.sessionMaxima.maxGForce, gForce),
    };
    
    set({ 
      history: newHistory,
      sessionMaxima: newMaxima
    });
  },

  addLog: (log: LogEntry) => {
    const state = get();
    const newLogs = [...state.logs, log];
    // Keep last 1000 log entries
    if (newLogs.length > 1000) {
      newLogs.shift();
    }
    set({ logs: newLogs });
  },

  setFollowLatest: (follow: boolean) => set({ followLatest: follow }),

  clearHistory: () => set({ 
    history: [], 
    sessionMaxima: {
      maxAltitude: 0,
      maxVelocity: 0,
      maxAcceleration: 0,
      maxGForce: 0,
    }
  }),
}));