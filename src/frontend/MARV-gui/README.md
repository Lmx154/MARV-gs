# Rocket Telemetry Dashboard

A production-ready, real-time telemetry dashboard for monitoring rocket flights. Built with React, TypeScript, and optimized for high-visibility outdoor use.

## Features

- **Real-time Data Visualization**: WebSocket integration with 20Hz telemetry updates
- **Dockable Panel System**: Fully customizable layout with resizable panels using Dockview
- **3D Rocket Orientation**: Real-time 3D visualization using Three.js with IMU data fusion
- **Live GPS Mapping**: Interactive map with flight path tracking and phase visualization
- **IMU Data Charts**: Multi-axis accelerometer and gyroscope data visualization
- **Flight Status Panel**: Real-time metrics with neon glow effects for phase changes
- **High-Contrast Design**: Optimized for outdoor visibility with WCAG AA compliance
- **Mock Simulation**: Built-in flight simulation for development and testing
- **PWA Support**: Offline capabilities and mobile-friendly design

## Quick Start

```bash
# Install dependencies
npm install

# Start development server with simulation
npm run dev

# Build for production
npm run build
```

The dashboard will open at `http://localhost:5173` with simulation mode active by default.

## Technology Stack

- **Framework**: React 18+ with TypeScript
- **Layout**: Dockview for dockable panels
- **Styling**: Custom CSS with high-contrast theme
- **3D Graphics**: Three.js with React Three Fiber
- **Charts**: Recharts for telemetry visualization  
- **Maps**: React Leaflet with OpenStreetMap
- **State Management**: Zustand
- **Build Tool**: Vite

## Project Structure

```
src/
├── components/           # React components
│   ├── ControlPanel.tsx  # Device connection and console
│   ├── IMULineChart.tsx  # Real-time IMU data charts
│   ├── Orientation3D.tsx # 3D rocket orientation
│   ├── StatusPanel.tsx   # Flight metrics and phase display
│   └── LiveMap.tsx       # GPS tracking map
├── hooks/               # Custom React hooks
│   ├── useTelemetryWebSocket.ts  # WebSocket connection
│   └── useTelemetrySimulation.ts # Mock data generation
├── store/               # Zustand state management
│   └── telemetryStore.ts
├── types/               # TypeScript interfaces
│   └── TelemetryPacket.ts
└── App.tsx             # Main application with Dockview layout
```

## Telemetry Data Format

The dashboard expects JSON telemetry packets via WebSocket:

```json
{
  "timestamp": 1640995200000,
  "imu": {
    "accel": {"x": 0.1, "y": 0.2, "z": 9.8},
    "gyro": {"x": 0.01, "y": -0.02, "z": 0.03},
    "mag": {"x": 0.3, "y": 0.1, "z": 0.8}
  },
  "gps": {"lat": 35.0844, "lon": -106.6504, "alt": 1200.5, "heading": 45.0},
  "baro": {"pressure": 1013.25, "altitude": 1200.0},
  "velocity": {"x": 10.0, "y": 5.0, "z": 50.0},
  "phase": "powered-ascent",
  "battery": 3.8,
  "rssi": -45.2
}
```

## Development

### Running with Real Hardware

1. Configure WebSocket URL in `useTelemetryWebSocket.ts` 
2. Set up telemetry source to send data to `ws://localhost:8080/telemetry`
3. Disable simulation mode in the control panel
4. Select appropriate device and connect

### Simulation Mode

The built-in simulation generates realistic flight data:
- 5-minute flight profile from pre-flight to landing
- Realistic physics modeling for altitude, velocity, and acceleration
- Progressive flight phases with appropriate phase transitions
- Mock sensor noise and GPS coordinates

### Customization

- **Layout**: Modify panel configuration in `App.tsx`
- **Styling**: Update color scheme in `src/index.css`
- **Data Processing**: Add filters and calculations in telemetry store
- **Visualization**: Extend chart types and 3D models in component files

## Deployment

The dashboard is optimized for:
- **Desktop**: Full-screen mission control setup
- **Laptop**: Portable field operations
- **Tablet**: Touch-friendly backup interface

PWA features enable offline operation and mobile installation.

## Performance

- Throttled updates at 60 FPS for smooth real-time visualization
- Efficient data buffering with automatic cleanup
- Optimized Three.js rendering with requestAnimationFrame
- Minimal re-renders using React.memo and selective subscriptions

## Accessibility

- WCAG AA compliant color contrast ratios
- Full keyboard navigation support
- ARIA labels and semantic HTML
- Reduced motion support for accessibility preferences
- High contrast mode compatibility

## License

MIT License - suitable for educational and commercial rocketry projects.