# MARV-gs Backend API & WebSocket Guide

This document describes the HTTP API and WebSocket contract for the MARV-gs backend. Use it from your external frontend to control the serial device and receive live data.

- Base URL (default): http://localhost:8000
- Auth: none
- Content-Type: application/json for HTTP requests/responses
- WebSocket URL: ws://localhost:8000/ws

## REST Endpoints

### POST /open
Open the serial port and start live streaming over WebSocket.

Request body
- port: string (e.g., "COM3" on Windows, "/dev/ttyUSB0" on Linux)
- baud: integer (typical values 9600, 115200, etc.)

Example
```json
{
  "port": "COM3",
  "baud": 115200
}
```

Responses
- 200 OK
  ```json
  {
    "state": "open",
    "port": "COM3",
    "baud": 115200
  }
  ```
- 409 Conflict — invalid state or device open failure (e.g., busy/invalid port)
  ```json
  { "detail": "Port is already open or opening" }
  ```
- 422 Unprocessable Entity — schema validation errors

Side effects
- Transitions FSM to OPEN (via OPENING) and spawns a background reader thread.
- Starts broadcasting serial data to all connected WebSocket clients at roughly 20 Hz (device permitting).

---

### POST /close
Close the serial port and stop streaming.

Request body
- none

Responses
- 200 OK
  ```json
  { "state": "closed" }
  ```

Notes
- Idempotent: calling when already closed is safe; result will be `closed`.

---

### POST /write
Write a command to the serial device (only allowed when OPEN).

Request body
- cmd: non-empty string. The server automatically appends a trailing `\n` when sending to the device.

Example
```json
{ "cmd": "STATUS" }
```

Responses
- 200 OK
  ```json
  { "written": 7 }
  ```
  `written` is the number of bytes written (including the appended newline).
- 409 Conflict — port not open or I/O error
  ```json
  { "detail": "Cannot write when port is not open" }
  ```
- 422 Unprocessable Entity — schema validation errors

## WebSocket: /ws
Connect to receive live serial data and state updates.

- URL: `ws://<host>:<port>/ws`
- Protocol: JSON text frames
- Multiple clients can connect; all receive the same broadcasts.
- On connect, the server immediately sends a status snapshot.

Message types

1) Status
```json
{
  "type": "status",
  "state": "closed" | "opening" | "open" | "closing" | "error"
}
```
Sent on connect and whenever the connection state changes (e.g., after /open or /close).

2) Data (live serial)
```json
{
  "type": "data",
  "line": "<exact line from device, UTF-8 decoded, may include \r and/or \n>",
  "ts": 1726312345.123
}
```
- `line` is the raw device output as text, decoded as UTF-8, preserving original newline characters. Trim client-side only if desired.
- `ts` is the server-side epoch timestamp (seconds, float) when the line was broadcast.
- Emission rate targets ~20 Hz, but actual frequency depends on device output and timing.

Client behavior
- The server ignores client-sent messages on the WebSocket; the channel is effectively server->client for streaming.
- If a serial error occurs, the server transitions to `error` and stops sending `data` frames until recovered (e.g., `POST /close` then `POST /open`).

## Typical Flow
1) Connect WebSocket to `/ws` and wait for the initial status snapshot.
2) POST `/open` with the desired `port` and `baud`.
3) Process `status` -> `open` and then consume streaming `data` messages.
4) Use `POST /write` to send commands while open.
5) POST `/close` to stop streaming and release the device.

## PowerShell examples (frontend/dev testing)

Open
```powershell
Invoke-RestMethod -Uri http://localhost:8000/open -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ port='COM3'; baud=115200 })
```

Write
```powershell
Invoke-RestMethod -Uri http://localhost:8000/write -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ cmd='STATUS' })
```

Close
```powershell
Invoke-RestMethod -Uri http://localhost:8000/close -Method Post
```

## Minimal WebSocket client (browser)
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'status') {
    console.log('State:', msg.state);
  } else if (msg.type === 'data') {
    // msg.line may include \r/\n as provided by the device
    console.log('Line:', msg.line);
  }
};
ws.onopen = () => console.log('WS connected');
ws.onclose = () => console.log('WS closed');
```

## Notes
- CORS: The backend enables permissive CORS for development (`*`). Lock this down for production as needed.
- Newlines: `line` includes any device-provided CR/LF. Display as-is for fidelity, or trim in the UI.
- Validation: 422 indicates request schema issues (e.g., missing/invalid `port`, `baud`, or `cmd`).
- Errors: 409 indicates invalid state or I/O problems; the response `detail` explains the cause.
