import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTelemetryStore } from '../store/telemetryStore';
import { Panel } from './layout/Panel';
import { format } from 'date-fns';

export const IMULineChart: React.FC = () => {
  const { history } = useTelemetryStore();

  // Process data for chart (last 60 seconds)
  const chartData = useMemo(() => {
    const now = Date.now();
    const sixtySecondsAgo = now - 60000;
    
    return history
      .filter(packet => packet.timestamp >= sixtySecondsAgo)
      .map(packet => ({
        time: packet.timestamp,
        accelX: packet.imu.accel.x,
        accelY: packet.imu.accel.y,
        accelZ: packet.imu.accel.z,
        gyroX: packet.imu.gyro.x,
        gyroY: packet.imu.gyro.y,
        gyroZ: packet.imu.gyro.z,
      }));
  }, [history]);

  const formatXAxisLabel = (tickItem: number) => {
    return format(new Date(tickItem), 'HH:mm:ss');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {format(new Date(label), 'HH:mm:ss.SSS')}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-xs">
              {entry.name}: {entry.value.toFixed(2)} {entry.name.startsWith('accel') ? 'm/s²' : '°/s'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Panel className="h-full">
      {chartData.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-500">
          No telemetry data available
        </div>
      ) : (
        <div className="h-full -m-3 mt-0 p-3 pt-1 flex flex-col">
          <ResponsiveContainer width="100%" height="50%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxisLabel}
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={12}
                label={{ value: 'Acceleration (m/s²)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="accelX"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                name="Accel X"
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="accelY"
                stroke="#EF4444"
                strokeWidth={2}
                dot={false}
                name="Accel Y"
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="accelZ"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Accel Z"
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
          
          <ResponsiveContainer width="100%" height="50%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxisLabel}
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={12}
                label={{ value: 'Angular Velocity (°/s)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="gyroX"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
                name="Gyro X"
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="gyroY"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                name="Gyro Y"
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="gyroZ"
                stroke="#EC4899"
                strokeWidth={2}
                dot={false}
                name="Gyro Z"
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
};