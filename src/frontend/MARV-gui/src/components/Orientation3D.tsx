import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Cylinder } from '@react-three/drei';
import { useTelemetryStore } from '../store/telemetryStore';
import { Panel } from './layout/Panel';
import * as THREE from 'three';

// Simple complementary filter for IMU fusion
const fuseIMU = (accel: { x: number; y: number; z: number }, gyro: { x: number; y: number; z: number }, dt: number) => {
  // Simplified quaternion from accelerometer (pitch and roll only)
  const pitch = Math.atan2(-accel.x, Math.sqrt(accel.y * accel.y + accel.z * accel.z));
  const roll = Math.atan2(accel.y, accel.z);
  
  // Apply gyro integration (simplified)
  const gyroQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    pitch + gyro.x * dt * 0.1,
    0, // Yaw would require magnetometer fusion
    roll + gyro.z * dt * 0.1
  ));
  
  return gyroQuaternion;
};

const RocketModel: React.FC = () => {
  const rocketRef = useRef<THREE.Group>(null);
  const { currentPacket } = useTelemetryStore();
  const lastTime = useRef(Date.now());

  useFrame(() => {
    if (currentPacket && rocketRef.current) {
      const now = Date.now();
      const dt = (now - lastTime.current) / 1000;
      lastTime.current = now;

      // Apply IMU fusion for orientation
      const quaternion = fuseIMU(currentPacket.imu.accel, currentPacket.imu.gyro, dt);
      rocketRef.current.setRotationFromQuaternion(quaternion);
    }
  });

  return (
    <group ref={rocketRef}>
      {/* Rocket body */}
      <Cylinder args={[0.1, 0.1, 2]} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#CCCCCC" />
      </Cylinder>
      
      {/* Nose cone */}
      <Cylinder args={[0, 0.1, 0.3]} position={[1.15, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#FF6B6B" />
      </Cylinder>
      
      {/* Fins */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <mesh position={[-0.8, 0.15, 0]}>
            <boxGeometry args={[0.4, 0.3, 0.02]} />
            <meshStandardMaterial color="#4ECDC4" />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const CoordinateAxes: React.FC = () => {
  return (
    <group>
      {/* X-axis (Red) */}
      <Line points={[[0, 0, 0], [2, 0, 0]]} color="red" lineWidth={3} />
      <Text position={[2.2, 0, 0]} fontSize={0.2} color="red">X</Text>
      
      {/* Y-axis (Green) */}
      <Line points={[[0, 0, 0], [0, 2, 0]]} color="green" lineWidth={3} />
      <Text position={[0, 2.2, 0]} fontSize={0.2} color="green">Y</Text>
      
      {/* Z-axis (Blue) */}
      <Line points={[[0, 0, 0], [0, 0, 2]]} color="blue" lineWidth={3} />
      <Text position={[0, 0, 2.2]} fontSize={0.2} color="blue">Z</Text>
    </group>
  );
};

const GroundPlane: React.FC = () => {
  return (
    <mesh position={[0, 0, -2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial color="#90EE90" opacity={0.3} transparent />
    </mesh>
  );
};

export const Orientation3D: React.FC = () => {
  const controlsRef = useRef<any>(null);

  return (
    <Panel>
      <div className="w-full h-full relative">
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }} className="w-full h-full">
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          
          <RocketModel />
          <CoordinateAxes />
          <GroundPlane />
          
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
          />
        </Canvas>
      </div>
    </Panel>
  );
};