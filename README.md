# MARV-gs

Cross-platform backend for real-time serial streaming using FastAPI + PySerial + WebSockets, plus a minimal PyQt6 desktop launcher.

## Prerequisites
- Python 3.9+
- UV package manager (recommended). Verify:

```powershell
uv --version
```

If UV isn’t installed, see https://docs.astral.sh/uv/

## Setup
Install dependencies into a UV-managed virtual environment:

```powershell
uv sync
```

## Run the backend server

```powershell
uv run uvicorn src.backend.app:app --reload --host 127.0.0.1 --port 8000
```

- Base URL: http://localhost:8000
- WebSocket: ws://localhost:8000/ws
- Static test UI: http://localhost:8000/test-ui/

## Minimal test UI (already included)
- Open in your browser: http://localhost:8000/test-ui/
- Buttons: Open / Close / Write
- Live stream: Shows exact device output (UTF‑8 decoded, preserves CR/LF)

## Desktop launcher (PyQt6)
Start a simple GUI that launches/stops the server and shows logs:

```powershell
uv run python -m src.ui.server_ui
```

From the UI, click “Start Server”, then “Open Test UI”.

## Build a Windows EXE
Use the included builder (PyInstaller under the hood).

One-file EXE (recommended):
```powershell
uv run python build.py --onefile
```

One-directory app (faster start, easier debug):
```powershell
uv run python build.py --onedir
```

Output
- One-file: `dist\MARV-gs.exe`
- One-dir: `dist\MARV-gs\`

Run the packaged app:
```powershell
./dist/MARV-gs.exe
```

Notes
- In the EXE, the server runs in-process (no reload); in dev it uses an external process with reload.
- Static files are bundled; test UI is at http://127.0.0.1:8000/test-ui/
- If Windows flags the EXE (SmartScreen), code-signing removes the warning in production.

## API reference
See `API.md` for full details:
- POST /open — open serial (e.g., COM6 @ 115200) and begin streaming
- POST /write — write a command (backend appends a newline)
- POST /close — close the port
- WebSocket /ws — live JSON messages: status and data (raw device lines)

## Quick PowerShell examples

```powershell
# Open (adjust port/baud)
Invoke-RestMethod -Uri http://localhost:8000/open -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ port='COM6'; baud=115200 })

# Write
Invoke-RestMethod -Uri http://localhost:8000/write -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{ cmd='PING' })

# Close
Invoke-RestMethod -Uri http://localhost:8000/close -Method Post
```

## Development

Run tests:

```powershell
uv run pytest -q
```

Notes:
- WebSocket forwards device output as-is (decoded UTF‑8), including CR/LF.
- CORS is permissive for local dev; lock it down for production.
- If the serial port is busy or invalid, `/open` returns 409 with details.

