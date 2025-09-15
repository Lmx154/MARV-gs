export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface IMUData {
  accel: Vector3;
  gyro: Vector3;
  mag: Vector3;
}

export interface GPSData {
  lat: number;
  lon: number;
  alt: number;
  heading: number;
}

export interface BaroData {
  pressure: number;
  altitude: number;
}

export type FlightPhase = 'pre-flight' | 'powered-ascent' | 'burnout' | 'apogee' | 'drogue-deploy' | 'main-deploy' | 'landed';

export interface TelemetryPacket {
  timestamp: number;
  imu: IMUData;
  gps: GPSData;
  baro: BaroData;
  velocity: Vector3;
  phase: FlightPhase;
  battery: number;
  rssi: number;
}

export interface LogEntry {
  type: 'info' | 'error' | 'warning' | 'success';
  message: string;
  timestamp: Date;
}

export interface SessionMaxima {
  maxAltitude: number;
  maxVelocity: number;
  maxAcceleration: number;
  maxGForce: number;
}

export interface TrajectoryPoint {
  position: Vector3;
  timestamp: number;
  phase: FlightPhase;
}