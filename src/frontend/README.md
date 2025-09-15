# Test Frontend (for local verification)

This folder contains a minimal test UI for manual verification of the backend APIs and WebSocket streaming. Your production frontend can live in a separate repository.

## Where to access it
- Test UI URL: `http://localhost:8000/test-ui/` (packaged EXE uses `http://127.0.0.1:8000/test-ui/`)
- WebSocket URL used by the UI: `ws://localhost:8000/ws`
- REST endpoints the UI calls:
  - `POST http://localhost:8000/open` { port: string, baud: number }
  - `POST http://localhost:8000/close`
  - `POST http://localhost:8000/write` { cmd: string }

The Test UI forwards the serial device output exactly as received (UTF-8 decoded, preserving CR/LF). It displays the live stream without polling.

## How to run the backend server

PowerShell (from repo root):
```powershell
uv run uvicorn src.backend.app:app --reload
```

Then open the test UI in your browser:
```
http://localhost:8000/test-ui/
```

## Notes
- The root path `/` serves static files from `src/frontend/`. The test UI is specifically at `/test-ui/`. The production GUI, when built, is at `/gui/`.
- The backend emits WebSocket messages:
  - Status: `{ "type": "status", "state": "closed|opening|open|closing|error" }`
  - Data: `{ "type": "data", "line": "<device text (may include \r/\n)>", "ts": <epoch-seconds> }`
- Writes automatically append a newline on the backend before sending to the serial device.
