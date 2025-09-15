import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { TelemetryPacket, FlightPhase } from '../types/TelemetryPacket';

// Realistic simulation for heavy L3 rocket with Aerotech M6000ST SuperThunder motor
// Adjusted for ~42 kg launch mass: net accel ~132 m/s², apogee ~2438 m (8k ft)
// Specifications: Total impulse 9510 N-s, burn time 1.6s, avg thrust 6000 N
// Launch site: Midland, TX (31.9973° N, 102.0779° W)
// Optimal near-vertical flight with light wind drift
// Drogue at 600 m AGL, main at 150 m AGL
// Drag tuned for heavy configuration (k=0.00006)
export const useTelemetrySimulation = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const t0Ref = useRef<number>(0);
  const stateRef = useRef({
    x: 0, // East (m)
    y: 0, // North (m)
    z: 0, // Up/altitude (m)
    vx: 0,
    vy: 0,
    vz: 0,
  });
  const flightPhaseRef = useRef<FlightPhase>('pre-flight');
  const apogeeReachedRef = useRef(false);
  const landedRef = useRef(false);

  // Parameters adjusted for heavy L3 rocket (~42 kg launch mass)
  const PRE_FLIGHT_DURATION = 2.0; // seconds (ignition prep)
  const BOOST_DURATION = 1.6; // seconds (burn time)
  const NET_ACCEL = 132; // m/s² (net upward after gravity, for heavy mass)
  const DROGUE_DEPLOY_ALT = 600; // meters AGL
  const MAIN_DEPLOY_ALT = 150; // meters AGL
  const DRAG_K = 0.00006; // quadratic drag coeff
  const WIND_ACCEL_X = 0.3; // m/s² eastward (light wind)
  const WIND_ACCEL_Y = 0.0; // no N-S wind
  const BASE_LAT = 31.9973; // Midland, TX
  const BASE_LON = -102.0779;
  const EARTH_RADIUS = 6371000; // meters
  const G = 9.81;

  const { addTelemetryPacket, setConnected, isSimulating, setSimulating } = useTelemetryStore();

  const stepSimulation = useCallback(() => {
    const now = Date.now();
    if (!t0Ref.current) {
      t0Ref.current = now;
      lastTickRef.current = now;
      return;
    }
    const dt = Math.min(0.05, (now - lastTickRef.current) / 1000);
    lastTickRef.current = now;
    const t = (now - t0Ref.current) / 1000;
    const s = stateRef.current;
    let phase = flightPhaseRef.current;

    // Compute accelerations based on *previous* phase
    let az = -G;
    let ax = WIND_ACCEL_X;
    let ay = WIND_ACCEL_Y;

    if (phase === 'powered-ascent') {
      az += NET_ACCEL;
      ax *= 0.1; // Reduced wind during high-thrust
      ay *= 0.1;
    } else if (phase === 'burnout' || phase === 'apogee') {
      // Coast: quadratic drag
      const vzAbs = Math.abs(s.vz);
      az += -Math.sign(s.vz) * DRAG_K * (vzAbs * vzAbs);
      const vxAbs = Math.abs(s.vx);
      const vyAbs = Math.abs(s.vy);
      ax += -Math.sign(s.vx) * DRAG_K * 0.5 * (vxAbs * vxAbs);
      ay += -Math.sign(s.vy) * DRAG_K * 0.5 * (vyAbs * vyAbs);
    } else if (phase === 'drogue-deploy') {
      const targetVz = -40;
      az += (targetVz - s.vz) * 0.5; // Parachute damping to terminal velocity
      const vxAbs = Math.abs(s.vx);
      const vyAbs = Math.abs(s.vy);
      ax += -Math.sign(s.vx) * DRAG_K * 0.5 * (vxAbs * vxAbs);
      ay += -Math.sign(s.vy) * DRAG_K * 0.5 * (vyAbs * vyAbs);
    } else if (phase === 'main-deploy') {
      const targetVz = -7;
      az += (targetVz - s.vz) * 0.9; // Slower terminal for main chute
      const vxAbs = Math.abs(s.vx);
      const vyAbs = Math.abs(s.vy);
      ax += -Math.sign(s.vx) * DRAG_K * 0.5 * (vxAbs * vxAbs);
      ay += -Math.sign(s.vy) * DRAG_K * 0.5 * (vyAbs * vyAbs);
    } else if (phase === 'landed') {
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      s.z = 0;
      az = ax = ay = 0;
    }

    // Numerical integration: velocities first, then positions
    s.vx += ax * dt;
    s.vy += ay * dt;
    s.vz += az * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;

    // Ground clamping
    if (s.z < 0) {
      s.z = 0;
      s.vz = 0;
    }

    // Update phase based on *new* t and *new* state (after integration/clamping)
    let newPhase: FlightPhase;
    if (t < PRE_FLIGHT_DURATION) {
      newPhase = 'pre-flight';
    } else if (t < PRE_FLIGHT_DURATION + BOOST_DURATION) {
      newPhase = 'powered-ascent';
    } else {
      // Post-burn logic with prioritized checks
      if (s.z <= 5 && Math.abs(s.vz) < 2) {
        newPhase = 'landed';
      } else if (!apogeeReachedRef.current && s.vz <= 0) {
        apogeeReachedRef.current = true;
        newPhase = 'apogee';
      } else if (apogeeReachedRef.current && s.vz < 0) {
        if (s.z > DROGUE_DEPLOY_ALT) {
          newPhase = 'burnout';
        } else if (s.z > MAIN_DEPLOY_ALT) {
          newPhase = 'drogue-deploy';
        } else {
          newPhase = 'main-deploy';
        }
      } else {
        newPhase = 'burnout';
      }
    }

    phase = newPhase;
    flightPhaseRef.current = phase;

    // Convert to GPS and generate packet (using updated phase and state)
    const lat0 = BASE_LAT * Math.PI / 180;
    const lon0 = BASE_LON * Math.PI / 180;
    const lat = lat0 + (s.y / EARTH_RADIUS);
    const lon = lon0 + (s.x / (EARTH_RADIUS * Math.cos(lat0)));
    const gpsAlt = s.z + (Math.random() - 0.5) * 2; // GPS noise

    // Heading (degrees, N=0)
    const heading = (Math.atan2(s.vx, s.vy) * 180 / Math.PI + 360) % 360;

    // IMU (raw, body-frame aligned to ENU + noise)
    const imuAccelX = ax + (Math.random() - 0.5) * 0.3;
    const imuAccelY = ay + (Math.random() - 0.5) * 0.3;
    const imuAccelZ = az + G + (Math.random() - 0.5) * 0.5; // Includes gravity
    const gyroNoise = 0.5;
    const gyroX = (Math.random() - 0.5) * gyroNoise; // Minimal rotation (straight flight)
    const gyroY = (Math.random() - 0.5) * gyroNoise;
    const gyroZ = (Math.random() - 0.5) * gyroNoise;
    const magX = 0.25 + (Math.random() - 0.5) * 0.02;
    const magY = 0.05 + (Math.random() - 0.5) * 0.02;
    const magZ = 0.9 + (Math.random() - 0.5) * 0.02;

    // Barometer (ISA approximation + noise)
    const pressure = 1013.25 * Math.exp(-s.z / 8430);
    const baroAlt = s.z + (Math.random() - 0.5) * 1.5;

    const packet: TelemetryPacket = {
      timestamp: now,
      imu: {
        accel: { x: imuAccelX, y: imuAccelY, z: imuAccelZ },
        gyro: { x: gyroX, y: gyroY, z: gyroZ },
        mag: { x: magX, y: magY, z: magZ },
      },
      gps: {
        lat: lat * 180 / Math.PI,
        lon: lon * 180 / Math.PI,
        alt: gpsAlt,
        heading,
      },
      baro: {
        pressure,
        altitude: baroAlt,
      },
      velocity: { x: s.vx, y: s.vy, z: s.vz },
      phase,
      battery: Math.max(3.2, 4.2 - t * 0.001), // Gradual discharge
      rssi: -35 - t * 0.03 + (Math.random() - 0.5) * 2, // Fade + noise
    };

    if (phase === 'landed') {
      if (!landedRef.current) {
        addTelemetryPacket(packet);
        landedRef.current = true;
        setTimeout(() => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setSimulating(false);
          setConnected(false);
        }, 2000); // Post-landing data
      }
      return;
    }

    addTelemetryPacket(packet);
  }, [addTelemetryPacket, setSimulating, setConnected]);

  const startSimulation = useCallback(() => {
    if (intervalRef.current) return;
    // Reset
    stateRef.current = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    flightPhaseRef.current = 'pre-flight';
    apogeeReachedRef.current = false;
    landedRef.current = false;
    t0Ref.current = 0;
    lastTickRef.current = 0;
    setConnected(true);
    intervalRef.current = setInterval(stepSimulation, 50); // 20 Hz
  }, [setConnected, stepSimulation]);

  const stopSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    if (isSimulating) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return () => stopSimulation();
  }, [isSimulating, startSimulation, stopSimulation]);

  return { startSimulation, stopSimulation };
};