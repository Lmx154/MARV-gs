import { useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';
import { useTelemetryStore } from '../store/telemetryStore';
import { TelemetryPacket, FlightPhase } from '../types/TelemetryPacket';

// Zod schema for telemetry packet validation
const TelemetryPacketSchema = z.object({
  timestamp: z.number(),
  imu: z.object({
    accel: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    gyro: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    mag: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }),
  gps: z.object({
    lat: z.number(),
    lon: z.number(),
    alt: z.number(),
    heading: z.number(),
  }),
  baro: z.object({
    pressure: z.number(),
    altitude: z.number(),
  }),
  velocity: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  phase: z.enum(['pre-flight', 'powered-ascent', 'burnout', 'apogee', 'drogue-deploy', 'main-deploy', 'landed']),
  battery: z.number(),
  rssi: z.number(),
});

interface UseTelemetryWebSocketProps {
  url: string;
  enabled: boolean;
}

export const useTelemetryWebSocket = ({ url, enabled }: UseTelemetryWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  
  const { setConnected, addTelemetryPacket, addLog, isSimulating } = useTelemetryStore();

  const connect = useCallback(() => {
    // Allow manual connect regardless of `enabled`; skip only if already open
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryCount.current = 0;
        addLog({
          type: 'success',
          message: `Connected to WebSocket: ${url}`,
          timestamp: new Date(),
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const packet = TelemetryPacketSchema.parse(data);
          addTelemetryPacket(packet);
        } catch (error) {
          addLog({
            type: 'error',
            message: `Invalid telemetry packet: ${error}`,
            timestamp: new Date(),
          });
        }
      };

      ws.onclose = () => {
        setConnected(false);
        
        if (enabled && retryCount.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
          addLog({
            type: 'warning',
            message: `Connection lost. Retrying in ${delay}ms...`,
            timestamp: new Date(),
          });
          
          retryTimeoutRef.current = setTimeout(() => {
            retryCount.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        addLog({
          type: 'error',
          message: `WebSocket error: ${error}`,
          timestamp: new Date(),
        });
      };
    } catch (error) {
      addLog({
        type: 'error',
        message: `Failed to connect: ${error}`,
        timestamp: new Date(),
      });
    }
  }, [url, setConnected, addTelemetryPacket, addLog]);

  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    if (enabled && !isSimulating) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, isSimulating, connect, disconnect]);

  return { connect, disconnect };
};